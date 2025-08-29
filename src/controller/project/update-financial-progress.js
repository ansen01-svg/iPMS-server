import mongoose from "mongoose";
import Project from "../../models/project.model.js";

/**
 * Update financial progress of a project
 * PUT /api/projects/:id/financial-progress
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
    const project = await Project.findById(id).session(session);
    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    // Check if financial progress updates are enabled
    if (!project.financialProgressUpdatesEnabled) {
      throw new Error("FINANCIAL_PROGRESS_UPDATES_DISABLED");
    }

    // Business logic validations
    const currentBillAmount = project.billSubmittedAmount || 0;
    const estimatedCost = project.estimatedCost;

    // Check if bill amount exceeds estimated cost
    if (billAmountNum > estimatedCost) {
      throw new Error("BILL_AMOUNT_EXCEEDS_ESTIMATED_COST");
    }

    // Prevent backwards financial progress (unless it's a small correction)
    if (billAmountNum < currentBillAmount) {
      const amountDecrease = currentBillAmount - billAmountNum;
      const costPercentage = (amountDecrease / estimatedCost) * 100;

      if (costPercentage > 5) {
        // Allow small corrections up to 5% of estimated cost
        throw new Error("BACKWARD_FINANCIAL_PROGRESS_NOT_ALLOWED");
      }
    }

    // Check for unrealistic financial progress jumps
    const amountIncrease = billAmountNum - currentBillAmount;
    const increasePercentage =
      estimatedCost > 0 ? (amountIncrease / estimatedCost) * 100 : 0;

    if (increasePercentage > 50) {
      // More than 50% increase in one update
      throw new Error("UNREALISTIC_FINANCIAL_PROGRESS_JUMP");
    }

    // Calculate new financial progress percentage
    const newFinancialProgress =
      estimatedCost > 0 ? Math.round((billAmountNum / estimatedCost) * 100) : 0;

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

    // Check for sub-projects if applicable
    if (project.hasSubProjects && project.subProjects.length > 0) {
      const totalSubProjectCost = project.subProjects.reduce(
        (sum, sub) => sum + (sub.estimatedAmount || 0),
        0
      );

      if (billAmountNum > totalSubProjectCost && totalSubProjectCost > 0) {
        console.warn(
          `Bill amount (₹${billAmountNum}) exceeds total sub-project cost (₹${totalSubProjectCost}) for project ${id}`
        );
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
    const enrichedProject = await Project.findById(id).session(session).lean();

    // Calculate virtual fields
    const projectData = {
      ...enrichedProject,
      remainingBudget:
        enrichedProject.estimatedCost - enrichedProject.billSubmittedAmount,
      progressStatus: getProgressStatus(enrichedProject.progressPercentage),
      financialProgressStatus: getProgressStatus(
        enrichedProject.financialProgress
      ),
      progressSummary: {
        physical: {
          percentage: enrichedProject.progressPercentage || 0,
          status: getProgressStatus(enrichedProject.progressPercentage || 0),
          lastUpdate: enrichedProject.lastProgressUpdate,
        },
        financial: {
          percentage: enrichedProject.financialProgress,
          status: getProgressStatus(enrichedProject.financialProgress),
          lastUpdate: enrichedProject.lastFinancialProgressUpdate,
          amountSubmitted: enrichedProject.billSubmittedAmount,
          amountRemaining:
            enrichedProject.estimatedCost - enrichedProject.billSubmittedAmount,
        },
      },
      totalSubProjectsCost: enrichedProject.subProjects
        ? enrichedProject.subProjects.reduce(
            (sum, sub) => sum + (sub.estimatedAmount || 0),
            0
          )
        : 0,
      projectDurationDays: calculateProjectDurationDays(enrichedProject),
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
            percentage: project.financialProgress || 0,
          },
          to: {
            amount: billAmountNum,
            percentage: newFinancialProgress,
          },
          difference: {
            amount: amountIncrease,
            percentage: newFinancialProgress - (project.financialProgress || 0),
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
        budgetAnalysis: {
          utilizationRate: Math.round((billAmountNum / estimatedCost) * 100),
          remainingBudget: estimatedCost - billAmountNum,
          isWithinBudget: billAmountNum <= estimatedCost,
          subProjectsCost: projectData.totalSubProjectsCost,
          subProjectsUtilization:
            projectData.totalSubProjectsCost > 0
              ? Math.round(
                  (billAmountNum / projectData.totalSubProjectsCost) * 100
                )
              : 0,
        },
      },
      metadata: {
        updatedAt: new Date().toISOString(),
        updatedBy: userInfo,
        totalFinancialProgressUpdates:
          enrichedProject.financialProgressUpdates.length,
        isFullyComplete:
          enrichedProject.progressPercentage === 100 &&
          enrichedProject.financialProgress === 100,
        projectType: {
          hasSubProjects: enrichedProject.hasSubProjects || false,
          subProjectsCount: enrichedProject.subProjects?.length || 0,
        },
        deadlineInfo: {
          daysUntilDeadline: enrichedProject.projectEndDate
            ? Math.ceil(
                (new Date(enrichedProject.projectEndDate) - new Date()) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
          hasExtension: !!enrichedProject.extensionPeriodForCompletion,
        },
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
          message: "Project not found",
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

      BILL_AMOUNT_EXCEEDS_ESTIMATED_COST: () =>
        res.status(400).json({
          success: false,
          message: "Bill amount cannot exceed the estimated cost",
          details: {
            estimatedCost: req.project?.estimatedCost,
            attemptedBillAmount: req.body.newBillAmount,
            maxAllowed: req.project?.estimatedCost,
          },
        }),

      BACKWARD_FINANCIAL_PROGRESS_NOT_ALLOWED: () =>
        res.status(400).json({
          success: false,
          message:
            "Significant backward financial progress is not allowed. Please contact administrator for corrections greater than 5% of estimated cost",
          details: {
            maxAllowedDecrease: "5% of estimated cost",
            currentBillAmount: req.project?.billSubmittedAmount,
            attemptedBillAmount: req.body.newBillAmount,
          },
        }),

      UNREALISTIC_FINANCIAL_PROGRESS_JUMP: () =>
        res.status(400).json({
          success: false,
          message:
            "Financial progress increase exceeds reasonable limits. Maximum 50% of estimated cost per update",
          details: {
            maxAllowedIncrease: "50% of estimated cost",
            estimatedCost: req.project?.estimatedCost,
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
 * GET /api/projects/:id/financial-progress/history
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

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
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
      firstUpdateDate:
        financialProgressUpdates.length > 0
          ? financialProgressUpdates[0].createdAt
          : null,
      largestAmountIncrease: Math.max(
        ...financialProgressUpdates.map((u) => u.amountDifference),
        0
      ),
      mostActiveUser: getMostActiveFinancialUser(financialProgressUpdates),
      billsSubmitted: financialProgressUpdates.filter(
        (u) => u.billDetails?.billNumber
      ).length,
    };

    // Calculate budget utilization trend
    const budgetTrend = financialProgressUpdates.map((update, index) => ({
      updateNumber: index + 1,
      date: update.createdAt,
      amount: update.newBillAmount,
      percentage: update.newFinancialProgress,
      utilizationRate:
        project.estimatedCost > 0
          ? Math.round((update.newBillAmount / project.estimatedCost) * 100)
          : 0,
    }));

    res.status(200).json({
      success: true,
      message: "Financial progress history retrieved successfully",
      data: {
        projectId: project._id,
        projectName: project.projectName,
        estimatedCost: project.estimatedCost,
        currentBillAmount: project.billSubmittedAmount,
        currentFinancialProgress: project.financialProgress,
        financialProgressStatus: getProgressStatus(project.financialProgress),
        remainingBudget: project.estimatedCost - project.billSubmittedAmount,
        history: historyData,
        summary: {
          ...summary,
          avgProgressChange: Math.round(summary.avgProgressChange * 100) / 100,
          avgAmountChange: Math.round(summary.avgAmountChange * 100) / 100,
        },
        budgetTrend,
        projectMetrics: {
          hasSubProjects: project.hasSubProjects || false,
          subProjectsCount: project.subProjects?.length || 0,
          totalSubProjectsCost: project.subProjects
            ? project.subProjects.reduce(
                (sum, sub) => sum + (sub.estimatedAmount || 0),
                0
              )
            : 0,
          daysFromStart: project.projectStartDate
            ? Math.ceil(
                (new Date() - new Date(project.projectStartDate)) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
          daysUntilDeadline: project.projectEndDate
            ? Math.ceil(
                (new Date(project.projectEndDate) - new Date()) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
          budgetUtilizationRate:
            project.estimatedCost > 0
              ? Math.round(
                  (project.billSubmittedAmount / project.estimatedCost) * 100
                )
              : 0,
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
 * GET /api/projects/financial-progress/statistics
 */
export const getFinancialProgressStatistics = async (req, res) => {
  try {
    const {
      status,
      district,
      createdBy,
      fund,
      typeOfWork,
      natureOfWork,
      startDate,
      endDate,
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (district) filter.district = district;
    if (createdBy) filter["createdBy.userId"] = createdBy;
    if (fund) filter.fund = fund;
    if (typeOfWork) filter.typeOfWork = typeOfWork;
    if (natureOfWork) filter.natureOfWork = natureOfWork;
    if (startDate || endDate) {
      filter.lastFinancialProgressUpdate = {};
      if (startDate)
        filter.lastFinancialProgressUpdate.$gte = new Date(startDate);
      if (endDate) filter.lastFinancialProgressUpdate.$lte = new Date(endDate);
    }

    // Get basic financial statistics
    const basicStats = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          totalEstimatedCost: { $sum: "$estimatedCost" },
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
          projectsWithSubProjects: {
            $sum: { $cond: [{ $eq: ["$hasSubProjects", true] }, 1, 0] },
          },
          overBudgetProjects: {
            $sum: {
              $cond: [
                { $gt: ["$billSubmittedAmount", "$estimatedCost"] },
                1,
                0,
              ],
            },
          },
          highUtilizationProjects: {
            $sum: {
              $cond: [{ $gte: ["$financialProgress", 80] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Get detailed financial progress update statistics
    const financialProgressUpdateStats =
      await Project.getFinancialProgressUpdateStats(filter);

    // Get fund-wise financial breakdown
    const fundFinancialStats = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$fund",
          projectCount: { $sum: 1 },
          totalEstimatedCost: { $sum: "$estimatedCost" },
          totalBillSubmitted: { $sum: "$billSubmittedAmount" },
          avgFinancialProgress: { $avg: "$financialProgress" },
          financiallyCompletedProjects: {
            $sum: { $cond: [{ $eq: ["$financialProgress", 100] }, 1, 0] },
          },
        },
      },
      { $sort: { totalEstimatedCost: -1 } },
      { $limit: 10 },
    ]);

    // Get district-wise financial breakdown
    const districtFinancialStats = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$district",
          projectCount: { $sum: 1 },
          totalEstimatedCost: { $sum: "$estimatedCost" },
          totalBillSubmitted: { $sum: "$billSubmittedAmount" },
          avgFinancialProgress: { $avg: "$financialProgress" },
          financiallyCompletedProjects: {
            $sum: { $cond: [{ $eq: ["$financialProgress", 100] }, 1, 0] },
          },
        },
      },
      { $sort: { totalBillSubmitted: -1 } },
      { $limit: 10 },
    ]);

    const result = {
      projectOverview: basicStats[0] || {
        totalProjects: 0,
        totalEstimatedCost: 0,
        totalBillSubmitted: 0,
        avgFinancialProgress: 0,
        financiallyCompletedProjects: 0,
        financiallyInProgressProjects: 0,
        financiallyNotStartedProjects: 0,
        totalFinancialProgressUpdates: 0,
        projectsWithSubProjects: 0,
        overBudgetProjects: 0,
        highUtilizationProjects: 0,
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
        result.projectOverview.totalEstimatedCost > 0
          ? Math.round(
              (result.projectOverview.totalBillSubmitted /
                result.projectOverview.totalEstimatedCost) *
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
      remainingBudget:
        result.projectOverview.totalEstimatedCost -
        result.projectOverview.totalBillSubmitted,
      overBudgetRate:
        result.projectOverview.totalProjects > 0
          ? Math.round(
              (result.projectOverview.overBudgetProjects /
                result.projectOverview.totalProjects) *
                100
            )
          : 0,
      highUtilizationRate:
        result.projectOverview.totalProjects > 0
          ? Math.round(
              (result.projectOverview.highUtilizationProjects /
                result.projectOverview.totalProjects) *
                100
            )
          : 0,
      avgProjectValue:
        result.projectOverview.totalProjects > 0
          ? Math.round(
              result.projectOverview.totalEstimatedCost /
                result.projectOverview.totalProjects
            )
          : 0,
      projectDistribution: {
        notStarted: result.projectOverview.financiallyNotStartedProjects,
        inProgress: result.projectOverview.financiallyInProgressProjects,
        completed: result.projectOverview.financiallyCompletedProjects,
        overBudget: result.projectOverview.overBudgetProjects,
        highUtilization: result.projectOverview.highUtilizationProjects,
      },
    };

    res.status(200).json({
      success: true,
      message: "Financial progress statistics retrieved successfully",
      data: {
        ...result,
        additionalMetrics,
        breakdowns: {
          byFund: fundFinancialStats.map((f) => ({
            fund: f._id,
            projectCount: f.projectCount,
            totalEstimatedCost: f.totalEstimatedCost,
            totalBillSubmitted: f.totalBillSubmitted,
            remainingBudget: f.totalEstimatedCost - f.totalBillSubmitted,
            avgFinancialProgress:
              Math.round(f.avgFinancialProgress * 100) / 100,
            financiallyCompletedProjects: f.financiallyCompletedProjects,
            financialCompletionRate:
              f.projectCount > 0
                ? Math.round(
                    (f.financiallyCompletedProjects / f.projectCount) * 100
                  )
                : 0,
            billSubmissionRate:
              f.totalEstimatedCost > 0
                ? Math.round(
                    (f.totalBillSubmitted / f.totalEstimatedCost) * 100
                  )
                : 0,
          })),
          byDistrict: districtFinancialStats.map((d) => ({
            district: d._id,
            projectCount: d.projectCount,
            totalEstimatedCost: d.totalEstimatedCost,
            totalBillSubmitted: d.totalBillSubmitted,
            remainingBudget: d.totalEstimatedCost - d.totalBillSubmitted,
            avgFinancialProgress:
              Math.round(d.avgFinancialProgress * 100) / 100,
            financiallyCompletedProjects: d.financiallyCompletedProjects,
            financialCompletionRate:
              d.projectCount > 0
                ? Math.round(
                    (d.financiallyCompletedProjects / d.projectCount) * 100
                  )
                : 0,
            billSubmissionRate:
              d.totalEstimatedCost > 0
                ? Math.round(
                    (d.totalBillSubmitted / d.totalEstimatedCost) * 100
                  )
                : 0,
          })),
        },
        budgetAnalysis: {
          totalBudget: result.projectOverview.totalEstimatedCost,
          totalUtilized: result.projectOverview.totalBillSubmitted,
          totalRemaining: additionalMetrics.remainingBudget,
          utilizationRate: additionalMetrics.billSubmissionRate,
          avgProjectBudget: additionalMetrics.avgProjectValue,
          budgetEfficiency: {
            onBudgetProjects:
              result.projectOverview.totalProjects -
              result.projectOverview.overBudgetProjects,
            overBudgetProjects: result.projectOverview.overBudgetProjects,
            highUtilizationProjects:
              result.projectOverview.highUtilizationProjects,
          },
        },
        filters: {
          status: status || null,
          district: district || null,
          createdBy: createdBy || null,
          fund: fund || null,
          typeOfWork: typeOfWork || null,
          natureOfWork: natureOfWork || null,
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
 * PUT /api/projects/:id/progress/combined
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
    const project = await Project.findById(id).session(session);
    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    const updates = [];
    const previousState = {
      physicalProgress: project.progressPercentage || 0,
      financialProgress: project.financialProgress || 0,
      billAmount: project.billSubmittedAmount || 0,
    };

    // Update physical progress if provided
    if (progress !== undefined) {
      const progressNum = parseFloat(progress);
      if (isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
        throw new Error("INVALID_PROGRESS_VALUE");
      }

      if (!project.progressUpdatesEnabled) {
        throw new Error("PROGRESS_UPDATES_DISABLED");
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

      if (billAmountNum > project.estimatedCost) {
        throw new Error("BILL_AMOUNT_EXCEEDS_ESTIMATED_COST");
      }

      if (!project.financialProgressUpdatesEnabled) {
        throw new Error("FINANCIAL_PROGRESS_UPDATES_DISABLED");
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
    const enrichedProject = await Project.findById(id).session(session).lean();

    // Calculate comprehensive project data
    const projectData = {
      ...enrichedProject,
      remainingBudget:
        enrichedProject.estimatedCost - enrichedProject.billSubmittedAmount,
      progressStatus: getProgressStatus(enrichedProject.progressPercentage),
      financialProgressStatus: getProgressStatus(
        enrichedProject.financialProgress
      ),
      progressSummary: {
        physical: {
          percentage: enrichedProject.progressPercentage || 0,
          status: getProgressStatus(enrichedProject.progressPercentage || 0),
          lastUpdate: enrichedProject.lastProgressUpdate,
        },
        financial: {
          percentage: enrichedProject.financialProgress || 0,
          status: getProgressStatus(enrichedProject.financialProgress || 0),
          lastUpdate: enrichedProject.lastFinancialProgressUpdate,
          amountSubmitted: enrichedProject.billSubmittedAmount || 0,
          amountRemaining:
            enrichedProject.estimatedCost -
            (enrichedProject.billSubmittedAmount || 0),
        },
      },
      projectDurationDays: calculateProjectDurationDays(enrichedProject),
      totalSubProjectsCost: enrichedProject.subProjects
        ? enrichedProject.subProjects.reduce(
            (sum, sub) => sum + (sub.estimatedAmount || 0),
            0
          )
        : 0,
    };

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
        project: projectData,
        updatesApplied: updates,
        progressChanges: {
          physical:
            progress !== undefined
              ? {
                  from: previousState.physicalProgress,
                  to: enrichedProject.progressPercentage,
                  difference:
                    (enrichedProject.progressPercentage || 0) -
                    previousState.physicalProgress,
                }
              : null,
          financial:
            newBillAmount !== undefined
              ? {
                  from: {
                    amount: previousState.billAmount,
                    percentage: previousState.financialProgress,
                  },
                  to: {
                    amount: enrichedProject.billSubmittedAmount,
                    percentage: enrichedProject.financialProgress,
                  },
                  difference: {
                    amount:
                      (enrichedProject.billSubmittedAmount || 0) -
                      previousState.billAmount,
                    percentage:
                      (enrichedProject.financialProgress || 0) -
                      previousState.financialProgress,
                  },
                }
              : null,
        },
        filesUploaded: {
          count: supportingDocuments.length,
          totalSize: supportingDocuments.reduce(
            (sum, file) => sum + file.fileSize,
            0
          ),
          byType: supportingDocuments.reduce((acc, file) => {
            acc[file.fileType] = (acc[file.fileType] || 0) + 1;
            return acc;
          }, {}),
        },
        progressAlignment: {
          gap: Math.abs(
            (enrichedProject.progressPercentage || 0) -
              (enrichedProject.financialProgress || 0)
          ),
          isAligned:
            Math.abs(
              (enrichedProject.progressPercentage || 0) -
                (enrichedProject.financialProgress || 0)
            ) <= 10, // Within 10% is considered aligned
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
          (enrichedProject.progressPercentage || 0) === 100 &&
          (enrichedProject.financialProgress || 0) === 100,
        totalUpdates: {
          physical: enrichedProject.progressUpdates?.length || 0,
          financial: enrichedProject.financialProgressUpdates?.length || 0,
          combined:
            (enrichedProject.progressUpdates?.length || 0) +
            (enrichedProject.financialProgressUpdates?.length || 0),
        },
        projectHealth: {
          budgetUtilization:
            enrichedProject.estimatedCost > 0
              ? Math.round(
                  ((enrichedProject.billSubmittedAmount || 0) /
                    enrichedProject.estimatedCost) *
                    100
                )
              : 0,
          scheduleStatus: getScheduleStatus(enrichedProject),
          overallScore: calculateProjectScore(enrichedProject),
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating combined progress:", error);

    // Use similar error handling as individual progress updates
    const errorHandlers = {
      INVALID_PROJECT_ID: () =>
        res.status(400).json({
          success: false,
          message: "Invalid project ID format",
        }),
      NO_PROGRESS_PROVIDED: () =>
        res.status(400).json({
          success: false,
          message:
            "At least one progress update (progress or newBillAmount) must be provided",
        }),
      UNAUTHORIZED_USER: () =>
        res.status(403).json({
          success: false,
          message:
            "Unauthorized. Only Junior Engineers (JE) can update project progress",
        }),
      PROJECT_NOT_FOUND: () =>
        res.status(404).json({
          success: false,
          message: "Project not found",
        }),
      // Add other specific error handlers as needed
    };

    const errorHandler = errorHandlers[error.message];
    if (errorHandler) {
      return errorHandler();
    }

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

// Helper function to calculate project duration in days
function calculateProjectDurationDays(project) {
  if (project.projectStartDate && project.projectEndDate) {
    const diffTime = Math.abs(
      new Date(project.projectEndDate) - new Date(project.projectStartDate)
    );
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
}

// Helper function to find most active user in financial updates
function getMostActiveFinancialUser(financialProgressUpdates) {
  if (financialProgressUpdates.length === 0) return null;

  const userCounts = {};
  financialProgressUpdates.forEach((update) => {
    const userId = update.updatedBy.userId;
    const userName = update.updatedBy.userName;
    userCounts[userId] = userCounts[userId] || { name: userName, count: 0 };
    userCounts[userId].count++;
  });

  const mostActive = Object.entries(userCounts).reduce(
    (max, [userId, data]) =>
      data.count > max.count ? { userId, ...data } : max,
    { count: 0 }
  );

  return mostActive.count > 0 ? mostActive : null;
}

// Helper function to determine schedule status
function getScheduleStatus(project) {
  if (!project.projectEndDate) return "No deadline set";

  const currentDate = new Date();
  const deadlineDate = new Date(
    project.extensionPeriodForCompletion || project.projectEndDate
  );
  const daysUntilDeadline = Math.ceil(
    (deadlineDate - currentDate) / (1000 * 60 * 60 * 24)
  );

  if ((project.progressPercentage || 0) === 100) return "Completed";
  if (daysUntilDeadline < 0) return "Overdue";
  if (daysUntilDeadline <= 7) return "Critical";
  if (daysUntilDeadline <= 30) return "At Risk";
  return "On Track";
}

// Helper function to calculate overall project score
function calculateProjectScore(project) {
  const physicalProgress = project.progressPercentage || 0;
  const financialProgress = project.financialProgress || 0;
  const progressAlignment =
    100 - Math.abs(physicalProgress - financialProgress);

  // Weighted score: 40% physical, 40% financial, 20% alignment
  const score = Math.round(
    physicalProgress * 0.4 + financialProgress * 0.4 + progressAlignment * 0.2
  );

  return Math.max(0, Math.min(100, score));
}

export default {
  updateFinancialProgress,
  getFinancialProgressHistory,
  getFinancialProgressStatistics,
  updateCombinedProgress,
};
