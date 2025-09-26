import mongoose from "mongoose";
import Project from "../../models/project.model.js";

/**
 * Update physical progress of a project
 * PUT /api/projects/:id/progress
 */
export const updateProjectProgress = async (req, res) => {
  // Use a session for transaction to ensure data consistency
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { id } = req.params;
    const { progress, remarks } = req.body;
    const user = req.user;

    // Process uploaded files from Firebase middleware
    const supportingDocuments = req.firebaseFiles || [];

    // Validation
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("INVALID_PROJECT_ID");
    }

    if (progress === undefined || progress === null) {
      throw new Error("PROGRESS_REQUIRED");
    }

    const progressNum = parseFloat(progress);
    if (isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
      throw new Error("INVALID_PROGRESS_VALUE");
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

    // Check if progress updates are enabled
    if (!project.progressUpdatesEnabled) {
      throw new Error("PROGRESS_UPDATES_DISABLED");
    }

    // Business logic validations
    const currentProgress = project.progressPercentage || 0;

    // Prevent backwards progress (unless it's a correction)
    if (progressNum < currentProgress) {
      const progressDecrease = currentProgress - progressNum;
      if (progressDecrease > 5) {
        // Allow small corrections up to 5%
        throw new Error("BACKWARD_PROGRESS_NOT_ALLOWED");
      }
    }

    // Check for unrealistic progress jumps
    const progressIncrease = progressNum - currentProgress;
    if (progressIncrease > 50) {
      // More than 50% increase in one update
      throw new Error("UNREALISTIC_PROGRESS_JUMP");
    }

    // Ensure completion requires supporting documentation
    if (progressNum === 100 && supportingDocuments.length === 0) {
      throw new Error("COMPLETION_REQUIRES_DOCUMENTS");
    }

    // Check project deadline if completing
    if (
      progressNum === 100 &&
      (project.projectEndDate || project.extensionPeriodForCompletion)
    ) {
      const currentDate = new Date();
      const effectiveDeadline =
        project.extensionPeriodForCompletion || project.projectEndDate;

      if (currentDate > effectiveDeadline) {
        const daysOverdue = Math.ceil(
          (currentDate - effectiveDeadline) / (1000 * 60 * 60 * 24)
        );
        console.warn(
          `Project ${id} completed ${daysOverdue} days after deadline`
        );
      }
    }

    // Prepare update data
    const updateData = {
      newProgress: progressNum,
      remarks: remarks || "",
      supportingDocuments,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent") || "",
    };

    const userInfo = {
      userId: user.id,
      userName: user.name || user.username,
      userDesignation: user.designation,
    };

    // Add progress update using the model method
    await project.addProgressUpdate(updateData, userInfo);

    // NEW: Auto-change status to "Completed" when progress reaches 100%
    let statusChanged = false;
    let statusChangeMessage = "";

    if (progressNum === 100 && project.status === "Ongoing") {
      try {
        const statusUserInfo = {
          userId: user.id,
          name: user.name || user.username,
          role: user.designation,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("User-Agent") || "",
        };

        await project.changeStatus(
          "Completed",
          statusUserInfo,
          "Project automatically marked as completed due to 100% progress achievement"
        );

        statusChanged = true;
        statusChangeMessage =
          "Project status automatically changed to 'Completed'";

        console.log(
          `Project ${id} status automatically changed to 'Completed' by user: ${user.id}`
        );
      } catch (statusError) {
        // Log the error but don't fail the progress update
        console.error(
          `Failed to auto-change project status to Completed for project ${id}:`,
          statusError.message
        );
        statusChangeMessage = `Progress updated to 100%, but status change failed: ${statusError.message}`;
      }
    } else if (progressNum === 100 && project.status !== "Ongoing") {
      statusChangeMessage = `Progress reached 100%, but project status is '${project.status}' instead of 'Ongoing'. Manual status change may be required.`;
    }

    // Get updated project with populated virtual fields
    const enrichedProject = await Project.findById(id).session(session).lean();

    // Calculate virtual fields
    const projectData = {
      ...enrichedProject,
      remainingBudget:
        enrichedProject.estimatedCost -
        (enrichedProject.billSubmittedAmount || 0),
      progressStatus: getProgressStatus(enrichedProject.progressPercentage),
      financialProgressStatus: getProgressStatus(
        enrichedProject.financialProgress
      ),
      progressSummary: {
        physical: {
          percentage: enrichedProject.progressPercentage,
          status: getProgressStatus(enrichedProject.progressPercentage),
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
    };

    // Get the latest progress update for response
    const latestUpdate =
      enrichedProject.progressUpdates[
        enrichedProject.progressUpdates.length - 1
      ];

    // Commit transaction
    await session.commitTransaction();

    // Log successful update
    console.log(
      `Project progress updated successfully for project ${id}: ${currentProgress}% -> ${progressNum}% by user: ${user.id}`
    );

    // Success response with status change information
    const response = {
      success: true,
      message: "Project progress updated successfully",
      data: {
        project: projectData,
        latestProgressUpdate: latestUpdate,
        progressChange: {
          from: currentProgress,
          to: progressNum,
          difference: progressIncrease,
          changeType:
            progressIncrease > 0
              ? "increase"
              : progressIncrease < 0
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
        // NEW: Status change information
        statusChange: {
          occurred: statusChanged,
          message: statusChangeMessage,
          newStatus: statusChanged ? "Completed" : enrichedProject.status,
          previousStatus: statusChanged ? "Ongoing" : enrichedProject.status,
        },
      },
      metadata: {
        updatedAt: new Date().toISOString(),
        updatedBy: userInfo,
        totalProgressUpdates: enrichedProject.progressUpdates.length,
        projectDurationDays: calculateProjectDurationDays(enrichedProject),
        daysUntilDeadline: enrichedProject.projectEndDate
          ? Math.ceil(
              (new Date(enrichedProject.projectEndDate) - new Date()) /
                (1000 * 60 * 60 * 24)
            )
          : null,
        // NEW: Completion information
        isCompleted: progressNum === 100,
        completedAt: statusChanged ? new Date().toISOString() : null,
      },
    };

    // Add status change message to main message if applicable
    if (statusChangeMessage) {
      response.message += `. ${statusChangeMessage}`;
    }

    res.status(200).json(response);
  } catch (error) {
    // Rollback transaction
    await session.abortTransaction();

    console.error("Error updating project progress:", error);

    // Handle specific errors (keeping existing error handlers)
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

      PROGRESS_REQUIRED: () =>
        res.status(400).json({
          success: false,
          message: "Progress percentage is required",
          details: {
            field: "progress",
            expectedType: "number",
            range: "0-100",
          },
        }),

      INVALID_PROGRESS_VALUE: () =>
        res.status(400).json({
          success: false,
          message: "Invalid progress value. Must be a number between 0 and 100",
          details: {
            providedValue: req.body.progress,
            validRange: "0-100",
            type: "percentage",
          },
        }),

      UNAUTHORIZED_USER: () =>
        res.status(403).json({
          success: false,
          message:
            "Unauthorized. Only Junior Engineers (JE) can update project progress",
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

      PROGRESS_UPDATES_DISABLED: () =>
        res.status(403).json({
          success: false,
          message: "Progress updates are disabled for this project",
          details: {
            projectId: req.params.id,
            reason: "Updates disabled by administrator",
          },
        }),

      BACKWARD_PROGRESS_NOT_ALLOWED: () =>
        res.status(400).json({
          success: false,
          message:
            "Significant backward progress is not allowed. Please contact administrator for corrections greater than 5%",
          details: {
            maxAllowedDecrease: "5%",
            currentProgress: req.project?.progressPercentage,
            attemptedProgress: req.body.progress,
          },
        }),

      UNREALISTIC_PROGRESS_JUMP: () =>
        res.status(400).json({
          success: false,
          message:
            "Progress increase exceeds reasonable limits. Maximum 50% increase per update",
          details: {
            maxAllowedIncrease: "50%",
            currentProgress: req.project?.progressPercentage,
            attemptedProgress: req.body.progress,
          },
        }),

      COMPLETION_REQUIRES_DOCUMENTS: () =>
        res.status(400).json({
          success: false,
          message:
            "Project completion (100% progress) requires at least one supporting document",
          details: {
            progress: 100,
            filesUploaded: 0,
            requirement: "Minimum 1 supporting file",
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
      message: "Internal server error occurred while updating project progress",
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
 * Get progress update history for a project
 * GET /api/projects/:id/progress/history
 */
export const getProgressHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 items per page

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

    // Get paginated progress history
    const historyData = project.getProgressUpdateHistory(page, limit);

    // Calculate summary statistics
    const progressUpdates = project.progressUpdates || [];
    const summary = {
      totalUpdates: progressUpdates.length,
      totalProgressIncrease: progressUpdates.reduce(
        (sum, update) => sum + Math.max(0, update.progressDifference),
        0
      ),
      totalProgressDecrease: Math.abs(
        progressUpdates.reduce(
          (sum, update) => sum + Math.min(0, update.progressDifference),
          0
        )
      ),
      totalFilesUploaded: progressUpdates.reduce(
        (sum, update) => sum + (update.supportingDocuments?.length || 0),
        0
      ),
      avgProgressChange:
        progressUpdates.length > 0
          ? progressUpdates.reduce(
              (sum, update) => sum + update.progressDifference,
              0
            ) / progressUpdates.length
          : 0,
      lastUpdateDate: project.lastProgressUpdate,
      firstUpdateDate:
        progressUpdates.length > 0 ? progressUpdates[0].createdAt : null,
      mostActiveUser: getMostActiveUser(progressUpdates),
      largestProgressJump: Math.max(
        ...progressUpdates.map((u) => u.progressDifference),
        0
      ),
    };

    res.status(200).json({
      success: true,
      message: "Progress history retrieved successfully",
      data: {
        projectId: project._id,
        projectName: project.projectName,
        currentProgress: project.progressPercentage,
        progressStatus: project.progressStatus,
        estimatedCost: project.estimatedCost,
        projectDuration: project.projectDurationDays,
        history: historyData,
        summary: {
          ...summary,
          avgProgressChange: Math.round(summary.avgProgressChange * 100) / 100,
        },
        projectMetrics: {
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
          hasExtension: !!project.extensionPeriodForCompletion,
          isOverdue:
            project.projectEndDate &&
            new Date() > new Date(project.projectEndDate),
        },
      },
    });
  } catch (error) {
    console.error("Error retrieving progress history:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving progress history",
    });
  }
};

/**
 * Get progress statistics across multiple projects
 * GET /api/projects/progress/statistics
 */
export const getProgressStatistics = async (req, res) => {
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
      filter.lastProgressUpdate = {};
      if (startDate) filter.lastProgressUpdate.$gte = new Date(startDate);
      if (endDate) filter.lastProgressUpdate.$lte = new Date(endDate);
    }

    // Get basic project statistics
    const basicStats = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          totalEstimatedCost: { $sum: "$estimatedCost" },
          avgProgress: { $avg: "$progressPercentage" },
          completedProjects: {
            $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
          },
          inProgressProjects: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$progressPercentage", 0] },
                    { $lt: ["$progressPercentage", 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          notStartedProjects: {
            $sum: { $cond: [{ $eq: ["$progressPercentage", 0] }, 1, 0] },
          },
          totalProgressUpdates: { $sum: { $size: "$progressUpdates" } },
          projectsWithSubProjects: {
            $sum: { $cond: [{ $eq: ["$hasSubProjects", true] }, 1, 0] },
          },
          totalSubProjects: { $sum: { $size: "$subProjects" } },
          overdueProjects: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ["$progressPercentage", 100] },
                    { $lt: ["$projectEndDate", new Date()] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Get detailed progress update statistics
    const progressUpdateStats = await Project.getProgressUpdateStats(filter);

    // Get district-wise breakdown
    const districtStats = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$district",
          projectCount: { $sum: 1 },
          avgProgress: { $avg: "$progressPercentage" },
          completedProjects: {
            $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
          },
          totalEstimatedCost: { $sum: "$estimatedCost" },
        },
      },
      { $sort: { projectCount: -1 } },
      { $limit: 10 },
    ]);

    // Get fund-wise breakdown
    const fundStats = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$fund",
          projectCount: { $sum: 1 },
          avgProgress: { $avg: "$progressPercentage" },
          completedProjects: {
            $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
          },
          totalEstimatedCost: { $sum: "$estimatedCost" },
        },
      },
      { $sort: { totalEstimatedCost: -1 } },
      { $limit: 10 },
    ]);

    const result = {
      projectOverview: basicStats[0] || {
        totalProjects: 0,
        totalEstimatedCost: 0,
        avgProgress: 0,
        completedProjects: 0,
        inProgressProjects: 0,
        notStartedProjects: 0,
        totalProgressUpdates: 0,
        projectsWithSubProjects: 0,
        totalSubProjects: 0,
        overdueProjects: 0,
      },
      progressUpdateStats: progressUpdateStats[0] || {
        totalUpdates: 0,
        avgProgressIncrease: 0,
        maxProgressIncrease: 0,
        minProgressIncrease: 0,
        totalFilesUploaded: 0,
      },
    };

    // Calculate additional metrics
    const additionalMetrics = {
      completionRate:
        result.projectOverview.totalProjects > 0
          ? Math.round(
              (result.projectOverview.completedProjects /
                result.projectOverview.totalProjects) *
                100
            )
          : 0,
      averageUpdatesPerProject:
        result.projectOverview.totalProjects > 0
          ? Math.round(
              (result.progressUpdateStats.totalUpdates /
                result.projectOverview.totalProjects) *
                100
            ) / 100
          : 0,
      overdueRate:
        result.projectOverview.totalProjects > 0
          ? Math.round(
              (result.projectOverview.overdueProjects /
                result.projectOverview.totalProjects) *
                100
            )
          : 0,
      subProjectUtilizationRate:
        result.projectOverview.totalProjects > 0
          ? Math.round(
              (result.projectOverview.projectsWithSubProjects /
                result.projectOverview.totalProjects) *
                100
            )
          : 0,
      avgSubProjectsPerProject:
        result.projectOverview.projectsWithSubProjects > 0
          ? Math.round(
              (result.projectOverview.totalSubProjects /
                result.projectOverview.projectsWithSubProjects) *
                100
            ) / 100
          : 0,
      projectDistribution: {
        notStarted: result.projectOverview.notStartedProjects,
        inProgress: result.projectOverview.inProgressProjects,
        completed: result.projectOverview.completedProjects,
        overdue: result.projectOverview.overdueProjects,
      },
    };

    res.status(200).json({
      success: true,
      message: "Progress statistics retrieved successfully",
      data: {
        ...result,
        additionalMetrics,
        breakdowns: {
          byDistrict: districtStats.map((d) => ({
            district: d._id,
            projectCount: d.projectCount,
            avgProgress: Math.round(d.avgProgress * 100) / 100,
            completedProjects: d.completedProjects,
            completionRate:
              d.projectCount > 0
                ? Math.round((d.completedProjects / d.projectCount) * 100)
                : 0,
            totalEstimatedCost: d.totalEstimatedCost,
          })),
          byFund: fundStats.map((f) => ({
            fund: f._id,
            projectCount: f.projectCount,
            avgProgress: Math.round(f.avgProgress * 100) / 100,
            completedProjects: f.completedProjects,
            completionRate:
              f.projectCount > 0
                ? Math.round((f.completedProjects / f.projectCount) * 100)
                : 0,
            totalEstimatedCost: f.totalEstimatedCost,
          })),
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
    console.error("Error retrieving progress statistics:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving progress statistics",
    });
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

// Helper function to find most active user in progress updates
function getMostActiveUser(progressUpdates) {
  if (progressUpdates.length === 0) return null;

  const userCounts = {};
  progressUpdates.forEach((update) => {
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

export default {
  updateProjectProgress,
  getProgressHistory,
  getProgressStatistics,
};
