import mongoose from "mongoose";
import {
  deleteUploadedFiles,
  processUploadedFiles,
} from "../../middlewares/fileUpload.middleware.js";
import ArchiveProject from "../../models/archive-project.model.js";

/**
 * Update progress of an archive project
 * PUT /api/archive-projects/:id/progress
 */
export const updateProjectProgress = async (req, res) => {
  // Use a session for transaction to ensure data consistency
  const session = await mongoose.startSession();
  let uploadedFiles = [];

  try {
    await session.startTransaction();

    const { id } = req.params;
    const { progress, remarks } = req.body;
    const user = req.user;

    // Process uploaded files
    uploadedFiles = req.files || [];
    const supportingDocuments = processUploadedFiles(uploadedFiles);

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
    const project = await ArchiveProject.findById(id).session(session);
    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    // Check if progress updates are enabled
    if (!project.progressUpdatesEnabled) {
      throw new Error("PROGRESS_UPDATES_DISABLED");
    }

    // Business logic validations
    const currentProgress = project.progress || 0;

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
    const updatedProject = await project.addProgressUpdate(
      updateData,
      userInfo
    );

    // Get updated project with populated virtual fields
    const enrichedProject = await ArchiveProject.findById(id)
      .session(session)
      .lean();

    // Calculate virtual fields
    const projectData = {
      ...enrichedProject,
      remainingWorkValue:
        enrichedProject.workValue - (enrichedProject.billSubmittedAmount || 0),
      progressStatus: getProgressStatus(enrichedProject.progress),
      financialProgress:
        enrichedProject.billSubmittedAmount && enrichedProject.workValue
          ? Math.round(
              (enrichedProject.billSubmittedAmount /
                enrichedProject.workValue) *
                100
            )
          : 0,
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
      `Progress updated successfully for project ${id}: ${currentProgress}% -> ${progressNum}% by user: ${user.id}`
    );

    // Success response
    res.status(200).json({
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
      },
      metadata: {
        updatedAt: new Date().toISOString(),
        updatedBy: userInfo,
        totalProgressUpdates: enrichedProject.progressUpdates.length,
      },
    });
  } catch (error) {
    // Rollback transaction
    await session.abortTransaction();

    // Delete uploaded files in case of error
    if (uploadedFiles.length > 0) {
      deleteUploadedFiles(uploadedFiles);
    }

    console.error("Error updating project progress:", error);

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
          message: "Archive project not found",
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
            currentProgress: req.project?.progress,
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
            currentProgress: req.project?.progress,
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
 * GET /api/archive-projects/:id/progress/history
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

    const project = await ArchiveProject.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Archive project not found",
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
    };

    res.status(200).json({
      success: true,
      message: "Progress history retrieved successfully",
      data: {
        projectId: project._id,
        projectName: project.nameOfWork,
        currentProgress: project.progress,
        progressStatus: project.progressStatus,
        history: historyData,
        summary: {
          ...summary,
          avgProgressChange: Math.round(summary.avgProgressChange * 100) / 100,
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
 * GET /api/archive-projects/progress/statistics
 */
export const getProgressStatistics = async (req, res) => {
  try {
    const { financialYear, concernedEngineer, startDate, endDate } = req.query;

    // Build filter
    const filter = {};
    if (financialYear) filter.financialYear = financialYear;
    if (concernedEngineer) filter.concernedEngineer = concernedEngineer;
    if (startDate || endDate) {
      filter.lastProgressUpdate = {};
      if (startDate) filter.lastProgressUpdate.$gte = new Date(startDate);
      if (endDate) filter.lastProgressUpdate.$lte = new Date(endDate);
    }

    // Get basic project statistics
    const basicStats = await ArchiveProject.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          avgProgress: { $avg: "$progress" },
          completedProjects: {
            $sum: { $cond: [{ $eq: ["$progress", 100] }, 1, 0] },
          },
          inProgressProjects: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$progress", 0] },
                    { $lt: ["$progress", 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          notStartedProjects: {
            $sum: { $cond: [{ $eq: ["$progress", 0] }, 1, 0] },
          },
          totalProgressUpdates: { $sum: { $size: "$progressUpdates" } },
        },
      },
    ]);

    // Get detailed progress update statistics
    const progressUpdateStats = await ArchiveProject.getProgressUpdateStats(
      filter
    );

    const result = {
      projectOverview: basicStats[0] || {
        totalProjects: 0,
        avgProgress: 0,
        completedProjects: 0,
        inProgressProjects: 0,
        notStartedProjects: 0,
        totalProgressUpdates: 0,
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
      projectDistribution: {
        notStarted: result.projectOverview.notStartedProjects,
        inProgress: result.projectOverview.inProgressProjects,
        completed: result.projectOverview.completedProjects,
      },
    };

    res.status(200).json({
      success: true,
      message: "Progress statistics retrieved successfully",
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

export default updateProjectProgress;
