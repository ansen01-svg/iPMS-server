import express from "express";
import mongoose from "mongoose";

// Controllers
import createProject from "../controller/project/create-project.js";
import {
  generateBulkProjectSummaryPDF,
  generateProjectSummaryPDFController,
  getPDFGenerationOptions,
} from "../controller/project/generate-pdf.js";
import getAllProjects from "../controller/project/get-all-projects.js";
import getProjectDropdownOptions from "../controller/project/get-dropdown-options.js";
import {
  getProjectById,
  getProjectTimeline,
} from "../controller/project/get-single-project-details.js";
import {
  getDistrictWiseProjectsSummary,
  getProjectsSummary,
} from "../controller/project/get-summary.js";
import {
  getFinancialProgressHistory,
  getFinancialProgressStatistics,
  updateCombinedProgress,
  updateFinancialProgress,
} from "../controller/project/update-financial-progress.js";
import {
  getProgressHistory,
  getProgressStatistics,
  updateProjectProgress,
} from "../controller/project/update-physical-progress.js";

// Authentication middleware
import { requireJe, requireLogin } from "../middlewares/auth.middleware.js";

// File upload middleware
import { createFileUploadMiddleware } from "../middlewares/firebaseUpload.middleware.js";

// Validation middleware for physical progress
import {
  handleValidationErrors,
  progressUpdateRateLimit,
  validateCompleteProgressUpdate,
  validateProgressHistoryQuery,
  validateProgressStatisticsQuery,
} from "../middlewares/validate-project-progress-update.middleware.js";

// Validation middleware for financial progress
import {
  financialProgressUpdateRateLimit,
  handleFinancialValidationErrors,
  validateCompleteCombinedProgressUpdate,
  validateCompleteFinancialProgressUpdate,
  validateFinancialProgressHistoryQuery,
  validateFinancialProgressStatisticsQuery,
} from "../middlewares/validate-project-progress-update.middleware.js";

// Project model for utility routes
import Project from "../models/project.model.js";

const router = express.Router();

// ==========================================
// BASIC PROJECT ROUTES
// ==========================================

// Get all projects
router.get("/", requireLogin(), getAllProjects);

// Create a new project (JE only)
router.post(
  "/",
  requireJe(),
  ...createFileUploadMiddleware({
    fieldName: "projectFiles",
    maxCount: 15,
    folder: "project-documents",
    requireFiles: false,
  }),
  createProject
);

// Get dropdown options for project creation
router.get("/dropdown-options", getProjectDropdownOptions);

// Get single project by ID with enhanced details
router.get("/:projectId", requireLogin(), getProjectById);

// Get project timeline/history
router.get("/:id/timeline", requireLogin(), getProjectTimeline);

// Get project summary statistics
router.get("/summary", requireLogin(), getProjectsSummary);

// Get district-wise project summary
router.get(
  "/summary/districts",
  requireLogin(),
  getDistrictWiseProjectsSummary
);

// ==========================================
// PHYSICAL PROGRESS ROUTES
// ==========================================

// Get progress statistics across projects
router.get(
  "/progress/statistics",
  requireLogin(),
  validateProgressStatisticsQuery,
  handleValidationErrors,
  getProgressStatistics
);

// Update project physical progress (JE only)
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
  ...validateCompleteProgressUpdate,
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
// FINANCIAL PROGRESS ROUTES
// ==========================================

// Get financial progress statistics across projects
router.get(
  "/financial-progress/statistics",
  requireLogin(),
  validateFinancialProgressStatisticsQuery,
  handleFinancialValidationErrors,
  getFinancialProgressStatistics
);

// Update financial progress (JE only)
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

// Enable/disable physical progress updates for a project
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

      if (typeof enabled !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Enabled flag must be a boolean value",
        });
      }

      const project = await Project.findByIdAndUpdate(
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

// Enable/disable financial progress updates for a project
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

      const project = await Project.findByIdAndUpdate(
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

// Toggle both progress update types at once
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

    const project = await Project.findByIdAndUpdate(id, updateFields, {
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
// PDF GENERATION ROUTES
// ==========================================

// Get PDF generation options for a specific project
router.get("/:id/pdf-options", requireLogin(), getPDFGenerationOptions);

// Generate and download project summary PDF
router.get(
  "/:id/download-summary-pdf",
  requireLogin(),
  generateProjectSummaryPDFController
);

// Alternative POST route for PDF generation with custom options
router.post(
  "/:id/generate-summary-pdf",
  requireLogin(),
  async (req, res, next) => {
    // Convert POST body parameters to query parameters for consistency
    req.query = { ...req.query, ...req.body };
    next();
  },
  generateProjectSummaryPDFController
);

// Bulk PDF generation for multiple projects (Admin/JE only)
router.post(
  "/bulk/generate-summary-pdf",
  requireJe(), // Could be requireAdmin() in production
  generateBulkProjectSummaryPDF
);

// ==========================================
// PROJECT COMPLETION AND STATUS ROUTES
// ==========================================

// Get project completion status (both physical and financial)
router.get("/:id/completion-status", requireLogin(), async (req, res) => {
  try {
    const { id } = req.params;

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

    const completionStatus = {
      physical: {
        percentage: project.progressPercentage || 0,
        status: project.progressStatus,
        isComplete: (project.progressPercentage || 0) === 100,
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
        amountRemaining: project.remainingBudget,
      },
      overall: {
        isFullyComplete:
          (project.progressPercentage || 0) === 100 &&
          (project.financialProgress || 0) === 100,
        completionScore: Math.round(
          ((project.progressPercentage || 0) +
            (project.financialProgress || 0)) /
            2
        ),
        progressGap: Math.abs(
          (project.progressPercentage || 0) - (project.financialProgress || 0)
        ),
      },
    };

    res.status(200).json({
      success: true,
      message: "Project completion status retrieved successfully",
      data: {
        projectId: project._id,
        projectName: project.projectName,
        estimatedCost: project.estimatedCost,
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

// Get projects nearing deadlines
router.get("/deadlines/upcoming", requireLogin(), async (req, res) => {
  try {
    const { days = 30, includeExtensions = true } = req.query;
    const daysAhead = parseInt(days);

    const currentDate = new Date();
    const futureDate = new Date();
    futureDate.setDate(currentDate.getDate() + daysAhead);

    // Build deadline filter
    const deadlineFilter =
      includeExtensions === "true"
        ? {
            $or: [
              {
                projectEndDate: { $gte: currentDate, $lte: futureDate },
                extensionPeriodForCompletion: { $exists: false },
              },
              {
                extensionPeriodForCompletion: {
                  $gte: currentDate,
                  $lte: futureDate,
                },
              },
            ],
          }
        : {
            projectEndDate: { $gte: currentDate, $lte: futureDate },
          };

    const upcomingDeadlines = await Project.find({
      ...deadlineFilter,
      progressPercentage: { $lt: 100 }, // Only incomplete projects
      status: { $in: ["Approved", "Ongoing"] }, // Only active projects
    })
      .select(
        "_id projectName progressPercentage financialProgress projectEndDate extensionPeriodForCompletion status district createdBy estimatedCost"
      )
      .sort({
        $expr: {
          $cond: {
            if: { $and: [{ $ne: ["$extensionPeriodForCompletion", null] }] },
            then: "$extensionPeriodForCompletion",
            else: "$projectEndDate",
          },
        },
      })
      .limit(50);

    const enrichedDeadlines = upcomingDeadlines.map((project) => {
      const effectiveDeadline =
        project.extensionPeriodForCompletion || project.projectEndDate;
      const daysRemaining = Math.ceil(
        (effectiveDeadline - currentDate) / (1000 * 60 * 60 * 24)
      );

      return {
        ...project.toObject(),
        effectiveDeadline,
        daysRemaining,
        hasExtension: !!project.extensionPeriodForCompletion,
        urgencyLevel:
          daysRemaining <= 7
            ? "critical"
            : daysRemaining <= 15
            ? "high"
            : "medium",
        completionGap: 100 - (project.progressPercentage || 0),
        progressSummary: {
          physical: {
            percentage: project.progressPercentage || 0,
            status: getProgressStatus(project.progressPercentage || 0),
          },
          financial: {
            percentage: project.financialProgress || 0,
            status: getProgressStatus(project.financialProgress || 0),
          },
        },
      };
    });

    const summary = {
      total: enrichedDeadlines.length,
      critical: enrichedDeadlines.filter((p) => p.urgencyLevel === "critical")
        .length,
      high: enrichedDeadlines.filter((p) => p.urgencyLevel === "high").length,
      medium: enrichedDeadlines.filter((p) => p.urgencyLevel === "medium")
        .length,
      withExtensions: enrichedDeadlines.filter((p) => p.hasExtension).length,
    };

    res.status(200).json({
      success: true,
      message: "Upcoming project deadlines retrieved successfully",
      data: {
        projects: enrichedDeadlines,
        summary,
        filters: {
          daysAhead,
          includeExtensions: includeExtensions === "true",
        },
      },
    });
  } catch (error) {
    console.error("Error getting upcoming deadlines:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// ==========================================
// BULK OPERATIONS
// ==========================================

// Bulk update progress for multiple projects
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

          const project = await Project.findById(projectId);
          if (!project) {
            errors.push({
              projectId,
              error: "Project not found",
            });
            continue;
          }

          let updated = false;
          const previousProgress = project.progressPercentage;
          const previousFinancialProgress = project.financialProgress;

          // Update physical progress if provided
          if (
            progress !== undefined &&
            progress !== project.progressPercentage
          ) {
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
              (financialProgress / 100) * project.estimatedCost
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
              previousProgress,
              newProgress: progress,
              previousFinancialProgress,
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

// ==========================================
// ANALYTICS AND REPORTING ROUTES
// ==========================================

// Get progress analytics over time
router.get("/analytics/progress-trends", requireLogin(), async (req, res) => {
  try {
    const {
      period = "monthly", // weekly, monthly, quarterly
      months = 12,
      district,
      fund,
      status,
    } = req.query;

    const periodsBack = parseInt(months);
    const endDate = new Date();
    const startDate = new Date();

    // Set start date based on period
    switch (period) {
      case "weekly":
        startDate.setDate(endDate.getDate() - periodsBack * 7);
        break;
      case "quarterly":
        startDate.setMonth(endDate.getMonth() - periodsBack * 3);
        break;
      default: // monthly
        startDate.setMonth(endDate.getMonth() - periodsBack);
        break;
    }

    // Build filter
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate },
    };
    if (district) filter.district = district;
    if (fund) filter.fund = fund;
    if (status) filter.status = status;

    // Determine grouping format
    let dateGroupFormat;
    switch (period) {
      case "weekly":
        dateGroupFormat = {
          year: { $year: "$createdAt" },
          week: { $week: "$createdAt" },
        };
        break;
      case "quarterly":
        dateGroupFormat = {
          year: { $year: "$createdAt" },
          quarter: {
            $ceil: {
              $divide: [{ $month: "$createdAt" }, 3],
            },
          },
        };
        break;
      default: // monthly
        dateGroupFormat = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        };
        break;
    }

    const trends = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: dateGroupFormat,
          totalProjects: { $sum: 1 },
          avgPhysicalProgress: { $avg: "$progressPercentage" },
          avgFinancialProgress: { $avg: "$financialProgress" },
          completedProjects: {
            $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
          },
          financiallyCompletedProjects: {
            $sum: { $cond: [{ $eq: ["$financialProgress", 100] }, 1, 0] },
          },
          totalEstimatedCost: { $sum: "$estimatedCost" },
          totalBillSubmitted: { $sum: "$billSubmittedAmount" },
          totalProgressUpdates: { $sum: { $size: "$progressUpdates" } },
          totalFinancialUpdates: {
            $sum: { $size: "$financialProgressUpdates" },
          },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.quarter": 1,
          "_id.week": 1,
        },
      },
    ]);

    const formattedTrends = trends.map((trend) => {
      let periodLabel;
      if (period === "weekly") {
        periodLabel = `${trend._id.year}-W${trend._id.week}`;
      } else if (period === "quarterly") {
        periodLabel = `${trend._id.year}-Q${trend._id.quarter}`;
      } else {
        periodLabel = `${trend._id.year}-${String(trend._id.month).padStart(
          2,
          "0"
        )}`;
      }

      return {
        period: periodLabel,
        totalProjects: trend.totalProjects,
        avgPhysicalProgress: Math.round(trend.avgPhysicalProgress * 100) / 100,
        avgFinancialProgress:
          Math.round(trend.avgFinancialProgress * 100) / 100,
        completedProjects: trend.completedProjects,
        financiallyCompletedProjects: trend.financiallyCompletedProjects,
        totalEstimatedCost: trend.totalEstimatedCost,
        totalBillSubmitted: trend.totalBillSubmitted,
        budgetUtilization:
          trend.totalEstimatedCost > 0
            ? Math.round(
                (trend.totalBillSubmitted / trend.totalEstimatedCost) * 100
              )
            : 0,
        totalUpdates: trend.totalProgressUpdates + trend.totalFinancialUpdates,
        completionRate:
          trend.totalProjects > 0
            ? Math.round((trend.completedProjects / trend.totalProjects) * 100)
            : 0,
        financialCompletionRate:
          trend.totalProjects > 0
            ? Math.round(
                (trend.financiallyCompletedProjects / trend.totalProjects) * 100
              )
            : 0,
      };
    });

    res.status(200).json({
      success: true,
      message: "Progress trends retrieved successfully",
      data: {
        trends: formattedTrends,
        metadata: {
          period,
          periodsAnalyzed: formattedTrends.length,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          filters: { district, fund, status },
        },
      },
    });
  } catch (error) {
    console.error("Error getting progress trends:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Helper function for progress status
function getProgressStatus(progress) {
  if (!progress) return "Not Started";
  if (progress < 25) return "Just Started";
  if (progress < 50) return "In Progress";
  if (progress < 75) return "Halfway Complete";
  if (progress < 100) return "Near Completion";
  return "Completed";
}

export default router;
