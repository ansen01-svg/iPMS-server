// src/controller/archive-project.js/update-financial-progress.js
import mongoose from "mongoose";
import ArchiveProject from "../../models/archive-project.model.js";

/**
 * Update financial progress of an archive project
 * PUT /api/archive-projects/:id/financial-progress
 */
export const updateFinancialProgress = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { id } = req.params;
    const { newBillAmount, remarks, billDetails } = req.body;
    const user = req.user;

    // Process uploaded files from Firebase middleware
    const supportingDocuments = req.firebaseFiles || [];

    // Validation
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("INVALID_PROJECT_ID");
    }

    if (newBillAmount === undefined || newBillAmount === null) {
      throw new Error("BILL_AMOUNT_REQUIRED");
    }

    const billAmountNum = parseFloat(newBillAmount);
    if (isNaN(billAmountNum) || billAmountNum < 0) {
      throw new Error("INVALID_BILL_AMOUNT");
    }

    // Check user authorization
    if (!user || user.designation !== "JE") {
      throw new Error("UNAUTHORIZED_USER");
    }

    // Find the project
    const project = await ArchiveProject.findById(id).session(session);
    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    // Check if financial progress updates are enabled
    if (!project.financialProgressUpdatesEnabled) {
      throw new Error("FINANCIAL_PROGRESS_UPDATES_DISABLED");
    }

    // Business logic validations
    const currentBillAmount = project.billSubmittedAmount || 0;
    const workValue = project.workValue;

    // Check if bill amount exceeds work value
    if (billAmountNum > workValue) {
      throw new Error("BILL_AMOUNT_EXCEEDS_WORK_VALUE");
    }

    // Prevent backwards financial progress (unless it's a small correction)
    if (billAmountNum < currentBillAmount) {
      const amountDecrease = currentBillAmount - billAmountNum;
      const workValuePercentage = (amountDecrease / workValue) * 100;

      if (workValuePercentage > 5) {
        // Allow small corrections up to 5% of work value
        throw new Error("BACKWARD_FINANCIAL_PROGRESS_NOT_ALLOWED");
      }
    }

    // Check for unrealistic financial progress jumps
    const amountIncrease = billAmountNum - currentBillAmount;
    const increasePercentage =
      workValue > 0 ? (amountIncrease / workValue) * 100 : 0;

    if (increasePercentage > 50) {
      // More than 50% increase in one update
      throw new Error("UNREALISTIC_FINANCIAL_PROGRESS_JUMP");
    }

    // Calculate new financial progress percentage
    const newFinancialProgress =
      workValue > 0 ? Math.round((billAmountNum / workValue) * 100) : 0;

    // Ensure completion requires supporting documentation
    if (newFinancialProgress === 100 && supportingDocuments.length === 0) {
      throw new Error("FINANCIAL_COMPLETION_REQUIRES_DOCUMENTS");
    }

    // Validate bill details if completing financially
    if (newFinancialProgress === 100) {
      if (!billDetails || !billDetails.billNumber) {
        throw new Error("FINAL_BILL_DETAILS_REQUIRED");
      }
    }

    // Prepare update data
    const updateData = {
      newBillAmount: billAmountNum,
      remarks: remarks || "",
      billDetails: {
        billNumber: billDetails?.billNumber || "",
        billDate: billDetails?.billDate
          ? new Date(billDetails.billDate)
          : new Date(),
        billDescription: billDetails?.billDescription || "",
      },
      supportingDocuments,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent") || "",
    };

    const userInfo = {
      userId: user.id,
      userName: user.name || user.username,
      userDesignation: user.designation,
    };

    // Add financial progress update using the model method
    await project.addFinancialProgressUpdate(updateData, userInfo);

    // Get updated project with populated virtual fields
    const enrichedProject = await ArchiveProject.findById(id)
      .session(session)
      .lean();

    // Calculate virtual fields
    const projectData = {
      ...enrichedProject,
      remainingWorkValue:
        enrichedProject.workValue - enrichedProject.billSubmittedAmount,
      progressStatus: getProgressStatus(enrichedProject.progress),
      financialProgressStatus: getProgressStatus(
        enrichedProject.financialProgress
      ),
      progressSummary: {
        physical: {
          percentage: enrichedProject.progress,
          status: getProgressStatus(enrichedProject.progress),
          lastUpdate: enrichedProject.lastProgressUpdate,
        },
        financial: {
          percentage: enrichedProject.financialProgress,
          status: getProgressStatus(enrichedProject.financialProgress),
          lastUpdate: enrichedProject.lastFinancialProgressUpdate,
          amountSubmitted: enrichedProject.billSubmittedAmount,
          amountRemaining:
            enrichedProject.workValue - enrichedProject.billSubmittedAmount,
        },
      },
    };

    // Get the latest financial progress update for response
    const latestUpdate =
      enrichedProject.financialProgressUpdates[
        enrichedProject.financialProgressUpdates.length - 1
      ];

    // Commit transaction
    await session.commitTransaction();

    // Log successful update
    console.log(
      `Financial progress updated successfully for project ${id}: ₹${currentBillAmount} -> ₹${billAmountNum} (${newFinancialProgress}%) by user: ${user.id}`
    );

    // Success response
    res.status(200).json({
      success: true,
      message: "Financial progress updated successfully",
      data: {
        project: projectData,
        latestFinancialProgressUpdate: latestUpdate,
        financialProgressChange: {
          from: {
            amount: currentBillAmount,
            percentage: project.financialProgress,
          },
          to: {
            amount: billAmountNum,
            percentage: newFinancialProgress,
          },
          difference: {
            amount: amountIncrease,
            percentage: newFinancialProgress - project.financialProgress,
          },
          changeType:
            amountIncrease > 0
              ? "increase"
              : amountIncrease < 0
              ? "decrease"
              : "no change",
        },
        filesUploaded: {
          count: supportingDocuments.length,
          totalSize: supportingDocuments.reduce(
            (sum, file) => sum + file.fileSize,
            0
          ),
          types: supportingDocuments.reduce((acc, file) => {
            acc[file.fileType] = (acc[file.fileType] || 0) + 1;
            return acc;
          }, {}),
        },
      },
      metadata: {
        updatedAt: new Date().toISOString(),
        updatedBy: userInfo,
        totalFinancialProgressUpdates:
          enrichedProject.financialProgressUpdates.length,
        isFullyComplete:
          enrichedProject.progress === 100 &&
          enrichedProject.financialProgress === 100,
      },
    });
  } catch (error) {
    // Rollback transaction
    await session.abortTransaction();

    console.error("Error updating financial progress:", error);

    // Handle specific errors
    const errorHandlers = {
      INVALID_PROJECT_ID: () =>
        res.status(400).json({
          success: false,
          message: "Invalid project ID format",
          details: {
            providedId: req.params.id,
            expectedFormat: "MongoDB ObjectId",
          },
        }),

      BILL_AMOUNT_REQUIRED: () =>
        res.status(400).json({
          success: false,
          message: "New bill amount is required",
          details: {
            field: "newBillAmount",
            expectedType: "number",
            minimum: 0,
          },
        }),

      INVALID_BILL_AMOUNT: () =>
        res.status(400).json({
          success: false,
          message: "Invalid bill amount. Must be a non-negative number",
          details: {
            providedValue: req.body.newBillAmount,
            validRange: "0 or greater",
            type: "monetary amount",
          },
        }),

      UNAUTHORIZED_USER: () =>
        res.status(403).json({
          success: false,
          message:
            "Unauthorized. Only Junior Engineers (JE) can update financial progress",
          details: {
            requiredRole: "JE",
            currentRole: req.user?.designation || "Unknown",
          },
        }),

      PROJECT_NOT_FOUND: () =>
        res.status(404).json({
          success: false,
          message: "Archive project not found",
          details: { searchedId: req.params.id },
        }),

      FINANCIAL_PROGRESS_UPDATES_DISABLED: () =>
        res.status(403).json({
          success: false,
          message: "Financial progress updates are disabled for this project",
          details: {
            projectId: req.params.id,
            reason: "Updates disabled by administrator",
          },
        }),

      BILL_AMOUNT_EXCEEDS_WORK_VALUE: () =>
        res.status(400).json({
          success: false,
          message: "Bill amount cannot exceed the total work value",
          details: {
            workValue: req.project?.workValue,
            attemptedBillAmount: req.body.newBillAmount,
            maxAllowed: req.project?.workValue,
          },
        }),

      BACKWARD_FINANCIAL_PROGRESS_NOT_ALLOWED: () =>
        res.status(400).json({
          success: false,
          message:
            "Significant backward financial progress is not allowed. Please contact administrator for corrections greater than 5% of work value",
          details: {
            maxAllowedDecrease: "5% of work value",
            currentBillAmount: req.project?.billSubmittedAmount,
            attemptedBillAmount: req.body.newBillAmount,
          },
        }),

      UNREALISTIC_FINANCIAL_PROGRESS_JUMP: () =>
        res.status(400).json({
          success: false,
          message:
            "Financial progress increase exceeds reasonable limits. Maximum 50% of work value per update",
          details: {
            maxAllowedIncrease: "50% of work value",
            workValue: req.project?.workValue,
            currentBillAmount: req.project?.billSubmittedAmount,
            attemptedBillAmount: req.body.newBillAmount,
          },
        }),

      FINANCIAL_COMPLETION_REQUIRES_DOCUMENTS: () =>
        res.status(400).json({
          success: false,
          message:
            "Financial completion (100% progress) requires at least one supporting document",
          details: {
            financialProgress: 100,
            filesUploaded: supportingDocuments.length,
            requirement: "Minimum 1 supporting file",
          },
        }),

      FINAL_BILL_DETAILS_REQUIRED: () =>
        res.status(400).json({
          success: false,
          message:
            "Final bill details are required when completing financial progress",
          details: {
            financialProgress: 100,
            requiredFields: ["billNumber"],
            providedBillDetails: req.body.billDetails,
          },
        }),
    };

    const errorHandler = errorHandlers[error.message];
    if (errorHandler) {
      return errorHandler();
    }

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
        value: err.value,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation error occurred",
        errors: validationErrors,
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while updating financial progress",
      error:
        process.env.NODE_ENV === "development"
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  } finally {
    // End session
    session.endSession();
  }
};

/**
 * Get financial progress update history for a project
 * GET /api/archive-projects/:id/financial-progress/history
 */
export const getFinancialProgressHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    const project = await ArchiveProject.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Archive project not found",
      });
    }

    // Get paginated financial progress history
    const historyData = project.getFinancialProgressUpdateHistory(page, limit);

    // Calculate summary statistics
    const financialProgressUpdates = project.financialProgressUpdates || [];
    const summary = {
      totalUpdates: financialProgressUpdates.length,
      totalAmountIncrease: financialProgressUpdates.reduce(
        (sum, update) => sum + Math.max(0, update.amountDifference),
        0
      ),
      totalAmountDecrease: Math.abs(
        financialProgressUpdates.reduce(
          (sum, update) => sum + Math.min(0, update.amountDifference),
          0
        )
      ),
      totalFilesUploaded: financialProgressUpdates.reduce(
        (sum, update) => sum + (update.supportingDocuments?.length || 0),
        0
      ),
      avgProgressChange:
        financialProgressUpdates.length > 0
          ? financialProgressUpdates.reduce(
              (sum, update) => sum + update.progressDifference,
              0
            ) / financialProgressUpdates.length
          : 0,
      avgAmountChange:
        financialProgressUpdates.length > 0
          ? financialProgressUpdates.reduce(
              (sum, update) => sum + update.amountDifference,
              0
            ) / financialProgressUpdates.length
          : 0,
      lastUpdateDate: project.lastFinancialProgressUpdate,
    };

    res.status(200).json({
      success: true,
      message: "Financial progress history retrieved successfully",
      data: {
        projectId: project._id,
        projectName: project.nameOfWork,
        workValue: project.workValue,
        currentBillAmount: project.billSubmittedAmount,
        currentFinancialProgress: project.financialProgress,
        financialProgressStatus: getProgressStatus(project.financialProgress),
        history: historyData,
        summary: {
          ...summary,
          avgProgressChange: Math.round(summary.avgProgressChange * 100) / 100,
          avgAmountChange: Math.round(summary.avgAmountChange * 100) / 100,
        },
      },
    });
  } catch (error) {
    console.error("Error retrieving financial progress history:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving financial progress history",
    });
  }
};

/**
 * Get financial progress statistics across multiple projects
 * GET /api/archive-projects/financial-progress/statistics
 */
export const getFinancialProgressStatistics = async (req, res) => {
  try {
    const { financialYear, concernedEngineer, startDate, endDate } = req.query;

    // Build filter
    const filter = {};
    if (financialYear) filter.financialYear = financialYear;
    if (concernedEngineer) filter.concernedEngineer = concernedEngineer;
    if (startDate || endDate) {
      filter.lastFinancialProgressUpdate = {};
      if (startDate)
        filter.lastFinancialProgressUpdate.$gte = new Date(startDate);
      if (endDate) filter.lastFinancialProgressUpdate.$lte = new Date(endDate);
    }

    // Get basic financial statistics
    const basicStats = await ArchiveProject.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          totalWorkValue: { $sum: "$workValue" },
          totalBillSubmitted: { $sum: "$billSubmittedAmount" },
          avgFinancialProgress: { $avg: "$financialProgress" },
          financiallyCompletedProjects: {
            $sum: { $cond: [{ $eq: ["$financialProgress", 100] }, 1, 0] },
          },
          financiallyInProgressProjects: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$financialProgress", 0] },
                    { $lt: ["$financialProgress", 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          financiallyNotStartedProjects: {
            $sum: { $cond: [{ $eq: ["$financialProgress", 0] }, 1, 0] },
          },
          totalFinancialProgressUpdates: {
            $sum: { $size: "$financialProgressUpdates" },
          },
        },
      },
    ]);

    // Get detailed financial progress update statistics
    const financialProgressUpdateStats =
      await ArchiveProject.getFinancialProgressUpdateStats(filter);

    const result = {
      projectOverview: basicStats[0] || {
        totalProjects: 0,
        totalWorkValue: 0,
        totalBillSubmitted: 0,
        avgFinancialProgress: 0,
        financiallyCompletedProjects: 0,
        financiallyInProgressProjects: 0,
        financiallyNotStartedProjects: 0,
        totalFinancialProgressUpdates: 0,
      },
      financialProgressUpdateStats: financialProgressUpdateStats[0] || {
        totalUpdates: 0,
        avgProgressIncrease: 0,
        avgAmountIncrease: 0,
        totalAmountSubmitted: 0,
        maxProgressIncrease: 0,
        minProgressIncrease: 0,
        totalFilesUploaded: 0,
      },
    };

    // Calculate additional metrics
    const additionalMetrics = {
      financialCompletionRate:
        result.projectOverview.totalProjects > 0
          ? Math.round(
              (result.projectOverview.financiallyCompletedProjects /
                result.projectOverview.totalProjects) *
                100
            )
          : 0,
      billSubmissionRate:
        result.projectOverview.totalWorkValue > 0
          ? Math.round(
              (result.projectOverview.totalBillSubmitted /
                result.projectOverview.totalWorkValue) *
                100
            )
          : 0,
      averageUpdatesPerProject:
        result.projectOverview.totalProjects > 0
          ? Math.round(
              (result.financialProgressUpdateStats.totalUpdates /
                result.projectOverview.totalProjects) *
                100
            ) / 100
          : 0,
      remainingWorkValue:
        result.projectOverview.totalWorkValue -
        result.projectOverview.totalBillSubmitted,
      projectDistribution: {
        notStarted: result.projectOverview.financiallyNotStartedProjects,
        inProgress: result.projectOverview.financiallyInProgressProjects,
        completed: result.projectOverview.financiallyCompletedProjects,
      },
    };

    res.status(200).json({
      success: true,
      message: "Financial progress statistics retrieved successfully",
      data: {
        ...result,
        additionalMetrics,
        filters: {
          financialYear: financialYear || null,
          concernedEngineer: concernedEngineer || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error retrieving financial progress statistics:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving financial progress statistics",
    });
  }
};

/**
 * Update both physical and financial progress together
 * PUT /api/archive-projects/:id/progress/combined
 */
export const updateCombinedProgress = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { id } = req.params;
    const { progress, newBillAmount, remarks, billDetails } = req.body;
    const user = req.user;

    // Process uploaded files from Firebase middleware
    const supportingDocuments = req.firebaseFiles || [];

    // Validation
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("INVALID_PROJECT_ID");
    }

    // At least one progress type must be provided
    if (progress === undefined && newBillAmount === undefined) {
      throw new Error("NO_PROGRESS_PROVIDED");
    }

    // Check user authorization
    if (!user || user.designation !== "JE") {
      throw new Error("UNAUTHORIZED_USER");
    }

    // Find the project
    const project = await ArchiveProject.findById(id).session(session);
    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    const updates = [];

    // Update physical progress if provided
    if (progress !== undefined) {
      const progressNum = parseFloat(progress);
      if (isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
        throw new Error("INVALID_PROGRESS_VALUE");
      }

      const progressUpdateData = {
        newProgress: progressNum,
        remarks: remarks || "",
        supportingDocuments: supportingDocuments.filter(
          (doc) =>
            doc.fileType === "image" || doc.originalName.includes("progress")
        ),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent") || "",
      };

      const userInfo = {
        userId: user.id,
        userName: user.name || user.username,
        userDesignation: user.designation,
      };

      await project.addProgressUpdate(progressUpdateData, userInfo);
      updates.push("physical");
    }

    // Update financial progress if provided
    if (newBillAmount !== undefined) {
      const billAmountNum = parseFloat(newBillAmount);
      if (isNaN(billAmountNum) || billAmountNum < 0) {
        throw new Error("INVALID_BILL_AMOUNT");
      }

      if (billAmountNum > project.workValue) {
        throw new Error("BILL_AMOUNT_EXCEEDS_WORK_VALUE");
      }

      const financialUpdateData = {
        newBillAmount: billAmountNum,
        remarks: remarks || "",
        billDetails: billDetails || {},
        supportingDocuments: supportingDocuments.filter(
          (doc) =>
            doc.fileType === "document" || doc.originalName.includes("bill")
        ),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("User-Agent") || "",
      };

      const userInfo = {
        userId: user.id,
        userName: user.name || user.username,
        userDesignation: user.designation,
      };

      await project.addFinancialProgressUpdate(financialUpdateData, userInfo);
      updates.push("financial");
    }

    // Get updated project
    const enrichedProject = await ArchiveProject.findById(id)
      .session(session)
      .lean();

    // Commit transaction
    await session.commitTransaction();

    // Log successful update
    console.log(
      `Combined progress updated successfully for project ${id}: ${updates.join(
        " and "
      )} progress updated by user: ${user.id}`
    );

    // Success response
    res.status(200).json({
      success: true,
      message: `Combined progress updated successfully (${updates.join(
        " and "
      )})`,
      data: {
        project: {
          ...enrichedProject,
          progressSummary: {
            physical: {
              percentage: enrichedProject.progress,
              status: getProgressStatus(enrichedProject.progress),
              lastUpdate: enrichedProject.lastProgressUpdate,
            },
            financial: {
              percentage: enrichedProject.financialProgress,
              status: getProgressStatus(enrichedProject.financialProgress),
              lastUpdate: enrichedProject.lastFinancialProgressUpdate,
              amountSubmitted: enrichedProject.billSubmittedAmount,
              amountRemaining:
                enrichedProject.workValue - enrichedProject.billSubmittedAmount,
            },
          },
        },
        updatesApplied: updates,
        filesUploaded: {
          count: supportingDocuments.length,
          totalSize: supportingDocuments.reduce(
            (sum, file) => sum + file.fileSize,
            0
          ),
        },
      },
      metadata: {
        updatedAt: new Date().toISOString(),
        updatedBy: {
          userId: user.id,
          userName: user.name || user.username,
          userDesignation: user.designation,
        },
        isFullyComplete:
          enrichedProject.progress === 100 &&
          enrichedProject.financialProgress === 100,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating combined progress:", error);

    // Use similar error handling as individual progress updates
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while updating combined progress",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

// Helper function to determine progress status
function getProgressStatus(progress) {
  if (!progress) return "Not Started";
  if (progress < 25) return "Just Started";
  if (progress < 50) return "In Progress";
  if (progress < 75) return "Halfway Complete";
  if (progress < 100) return "Near Completion";
  return "Completed";
}

export default {
  updateFinancialProgress,
  getFinancialProgressHistory,
  getFinancialProgressStatistics,
  updateCombinedProgress,
};
