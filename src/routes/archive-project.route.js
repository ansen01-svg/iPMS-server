import express from "express";
import mongoose from "mongoose";
import createArchiveProject from "../controller/archive-project.js/create-archive-project.js";
import getAllArchiveProjects from "../controller/archive-project.js/get-all-archive-projects.js";
import getFilterOptions from "../controller/archive-project.js/get-filter-options.js";
import {
  getArchiveProjectById,
  getArchiveProjectTimeline,
} from "../controller/archive-project.js/get-single-archive-project.js";
import { getArchiveProjectsSummary } from "../controller/archive-project.js/get-summary.js";
import {
  getFinancialProgressHistory,
  getFinancialProgressStatistics,
  updateCombinedProgress,
  updateFinancialProgress,
} from "../controller/archive-project.js/update-financial-progress.js";
import {
  getProgressHistory,
  getProgressStatistics,
  updateProjectProgress,
} from "../controller/archive-project.js/update-physical-progress.js";

// Authentication middleware
import { requireJe, requireLogin } from "../middlewares/auth.middleware.js";
import { createFileUploadMiddleware } from "../middlewares/firebaseUpload.middleware.js";

// Validation middleware
import {
  handleValidationErrors,
  progressUpdateRateLimit,
  validateProgressBusinessRules,
  validateProgressHistoryQuery,
  validateProgressStatisticsQuery,
  validateProgressUpdate,
} from "../middlewares/validate-archive-project-progress.middleware.js";

// NEW: Financial progress validation middleware
import {
  financialProgressUpdateRateLimit,
  handleFinancialValidationErrors,
  validateCompleteCombinedProgressUpdate,
  validateCompleteFinancialProgressUpdate,
  validateFinancialProgressHistoryQuery,
  validateFinancialProgressStatisticsQuery,
} from "../middlewares/validate-archive-project-financial-progress.middleware.js";

// NEW: Import the model for utility routes
import ArchiveProject from "../models/archive-project.model.js";

const router = express.Router();

// ==========================================
// EXISTING ROUTES (Updated to use Firebase)
// ==========================================

// Get all archive projects with filtering, pagination, and search
router.get("/", requireLogin(), getAllArchiveProjects);

// Create new archive project (JE only)
router.post("/", requireJe(), createArchiveProject);

// Get filter options for frontend dropdowns
router.get("/filter-options", requireLogin(), getFilterOptions);

// Get summary statistics
router.get("/summary", requireLogin(), getArchiveProjectsSummary);

// Get single archive project by ID
router.get("/:id", requireLogin(), getArchiveProjectById);

// Get project timeline/history
router.get("/:id/timeline", requireLogin(), getArchiveProjectTimeline);

// ==========================================
// UPDATED PROGRESS ROUTES (Now using Firebase)
// ==========================================

// Get progress statistics across projects
router.get(
  "/progress/statistics",
  requireLogin(),
  validateProgressStatisticsQuery,
  handleValidationErrors,
  getProgressStatistics
);

// Update project progress with Firebase file uploads (JE only)
router.put(
  "/:id/progress",
  requireJe(),
  progressUpdateRateLimit,
  ...createFileUploadMiddleware({
    fieldName: "supportingFiles",
    maxCount: 10,
    folder: "progress-updates",
    requireFiles: false,
  }),
  validateProgressUpdate,
  handleValidationErrors,
  validateProgressBusinessRules,
  updateProjectProgress
);

// Get progress update history for a specific project
router.get(
  "/:id/progress/history",
  requireLogin(),
  validateProgressHistoryQuery,
  handleValidationErrors,
  getProgressHistory
);

// ==========================================
// NEW FINANCIAL PROGRESS ROUTES
// ==========================================

// Get financial progress statistics across projects
router.get(
  "/financial-progress/statistics",
  requireLogin(),
  validateFinancialProgressStatisticsQuery,
  handleFinancialValidationErrors,
  getFinancialProgressStatistics
);

// Update financial progress with Firebase file uploads (JE only)
router.put(
  "/:id/financial-progress",
  requireJe(),
  financialProgressUpdateRateLimit,
  ...createFileUploadMiddleware({
    fieldName: "supportingFiles",
    maxCount: 10,
    folder: "financial-updates",
    requireFiles: false,
  }),
  ...validateCompleteFinancialProgressUpdate,
  updateFinancialProgress
);

// Get financial progress update history for a specific project
router.get(
  "/:id/financial-progress/history",
  requireLogin(),
  validateFinancialProgressHistoryQuery,
  handleFinancialValidationErrors,
  getFinancialProgressHistory
);

// ==========================================
// COMBINED PROGRESS ROUTES
// ==========================================

// Update both physical and financial progress together (JE only)
router.put(
  "/:id/progress/combined",
  requireJe(),
  financialProgressUpdateRateLimit, // Use financial rate limit as it's more restrictive
  ...createFileUploadMiddleware({
    fieldName: "supportingFiles",
    maxCount: 15, // Allow more files for combined updates
    folder: "combined-updates",
    requireFiles: false,
  }),
  ...validateCompleteCombinedProgressUpdate,
  updateCombinedProgress
);

// ==========================================
// UTILITY ROUTES FOR PROGRESS MANAGEMENT
// ==========================================

// Enable/disable progress updates for a project (Admin only)
router.patch(
  "/:id/progress/toggle",
  requireLogin(), // In production, you might want requireAdmin()
  async (req, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID format",
        });
      }

      const project = await ArchiveProject.findByIdAndUpdate(
        id,
        { progressUpdatesEnabled: enabled },
        { new: true }
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      res.status(200).json({
        success: true,
        message: `Progress updates ${
          enabled ? "enabled" : "disabled"
        } successfully`,
        data: {
          projectId: project._id,
          progressUpdatesEnabled: project.progressUpdatesEnabled,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error toggling progress updates:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// NEW: Enable/disable financial progress updates for a project (Admin only)
router.patch(
  "/:id/financial-progress/toggle",
  requireLogin(), // In production, you might want requireAdmin()
  async (req, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID format",
        });
      }

      if (typeof enabled !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Enabled flag must be a boolean value",
        });
      }

      const project = await ArchiveProject.findByIdAndUpdate(
        id,
        { financialProgressUpdatesEnabled: enabled },
        { new: true }
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      res.status(200).json({
        success: true,
        message: `Financial progress updates ${
          enabled ? "enabled" : "disabled"
        } successfully`,
        data: {
          projectId: project._id,
          financialProgressUpdatesEnabled:
            project.financialProgressUpdatesEnabled,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error toggling financial progress updates:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// NEW: Toggle both progress update types at once (Admin only)
router.patch("/:id/progress/toggle-all", requireLogin(), async (req, res) => {
  try {
    const { id } = req.params;
    const { progressEnabled, financialProgressEnabled } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    const updateFields = {};
    if (typeof progressEnabled === "boolean") {
      updateFields.progressUpdatesEnabled = progressEnabled;
    }
    if (typeof financialProgressEnabled === "boolean") {
      updateFields.financialProgressUpdatesEnabled = financialProgressEnabled;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one progress type must be specified",
      });
    }

    const project = await ArchiveProject.findByIdAndUpdate(id, updateFields, {
      new: true,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Progress update settings updated successfully",
      data: {
        projectId: project._id,
        progressUpdatesEnabled: project.progressUpdatesEnabled,
        financialProgressUpdatesEnabled:
          project.financialProgressUpdatesEnabled,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error toggling all progress updates:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// ==========================================
// PROJECT COMPLETION AND STATUS ROUTES
// ==========================================

// NEW: Get project completion status (both physical and financial)
router.get("/:id/completion-status", requireLogin(), async (req, res) => {
  try {
    const { id } = req.params;

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
        message: "Project not found",
      });
    }

    const completionStatus = {
      physical: {
        percentage: project.progress || 0,
        status: project.progressStatus,
        isComplete: (project.progress || 0) === 100,
        lastUpdate: project.lastProgressUpdate,
        totalUpdates: project.totalProgressUpdates,
      },
      financial: {
        percentage: project.financialProgress || 0,
        status: project.financialProgressStatus,
        isComplete: (project.financialProgress || 0) === 100,
        lastUpdate: project.lastFinancialProgressUpdate,
        totalUpdates: project.totalFinancialProgressUpdates,
        amountSubmitted: project.billSubmittedAmount,
        amountRemaining: project.remainingBillAmount,
      },
      overall: {
        isFullyComplete:
          (project.progress || 0) === 100 &&
          (project.financialProgress || 0) === 100,
        completionScore: Math.round(
          ((project.progress || 0) + (project.financialProgress || 0)) / 2
        ),
        progressGap: Math.abs(
          (project.progress || 0) - (project.financialProgress || 0)
        ),
      },
    };

    res.status(200).json({
      success: true,
      message: "Project completion status retrieved successfully",
      data: {
        projectId: project._id,
        projectName: project.nameOfWork,
        workValue: project.workValue,
        completionStatus,
      },
    });
  } catch (error) {
    console.error("Error getting completion status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// ==========================================
// BULK OPERATIONS (Optional Advanced Features)
// ==========================================

// NEW: Bulk update progress for multiple projects (Admin only)
router.post(
  "/bulk/progress-update",
  requireLogin(), // In production: requireAdmin()
  async (req, res) => {
    try {
      const { updates } = req.body; // Array of {projectId, progress, financialProgress, remarks}
      const user = req.user;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Updates array is required and cannot be empty",
        });
      }

      if (updates.length > 50) {
        // Limit bulk operations
        return res.status(400).json({
          success: false,
          message: "Maximum 50 projects can be updated in one bulk operation",
        });
      }

      const results = [];
      const errors = [];

      for (const update of updates) {
        try {
          const { projectId, progress, financialProgress, remarks } = update;

          if (!mongoose.Types.ObjectId.isValid(projectId)) {
            errors.push({
              projectId,
              error: "Invalid project ID format",
            });
            continue;
          }

          const project = await ArchiveProject.findById(projectId);
          if (!project) {
            errors.push({
              projectId,
              error: "Project not found",
            });
            continue;
          }

          let updated = false;

          // Update physical progress if provided
          if (progress !== undefined && progress !== project.progress) {
            await project.addProgressUpdate(
              {
                newProgress: progress,
                remarks: remarks || "Bulk update",
                supportingDocuments: [],
                ipAddress: req.ip,
                userAgent: req.get("User-Agent"),
              },
              {
                userId: user.id,
                userName: user.name || user.username,
                userDesignation: user.designation,
              }
            );
            updated = true;
          }

          // Update financial progress if provided
          if (
            financialProgress !== undefined &&
            financialProgress !== project.financialProgress
          ) {
            // Calculate new bill amount based on financial progress percentage
            const newBillAmount = Math.round(
              (financialProgress / 100) * project.workValue
            );

            await project.addFinancialProgressUpdate(
              {
                newBillAmount,
                remarks: remarks || "Bulk update",
                billDetails: {},
                supportingDocuments: [],
                ipAddress: req.ip,
                userAgent: req.get("User-Agent"),
              },
              {
                userId: user.id,
                userName: user.name || user.username,
                userDesignation: user.designation,
              }
            );
            updated = true;
          }

          if (updated) {
            results.push({
              projectId,
              status: "updated",
              previousProgress: project.progress,
              newProgress: progress,
              previousFinancialProgress: project.financialProgress,
              newFinancialProgress: financialProgress,
            });
          } else {
            results.push({
              projectId,
              status: "no_changes",
            });
          }
        } catch (error) {
          console.error(`Error updating project ${update.projectId}:`, error);
          errors.push({
            projectId: update.projectId,
            error: error.message,
          });
        }
      }

      res.status(200).json({
        success: true,
        message: `Bulk update completed. ${results.length} processed, ${errors.length} errors`,
        data: {
          successful: results,
          failed: errors,
          summary: {
            total: updates.length,
            successful: results.length,
            failed: errors.length,
          },
        },
      });
    } catch (error) {
      console.error("Error in bulk progress update:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during bulk update",
      });
    }
  }
);

export default router;
