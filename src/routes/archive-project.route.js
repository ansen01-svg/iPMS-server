import express from "express";
import createArchiveProject from "../controller/archive-project.js/create-archive-project.js";
import getAllArchiveProjects from "../controller/archive-project.js/get-all-archive-projects.js";
import getFilterOptions from "../controller/archive-project.js/get-filter-options.js";
import {
  getArchiveProjectById,
  getArchiveProjectTimeline,
} from "../controller/archive-project.js/get-single-archive-project.js";
import { getArchiveProjectsSummary } from "../controller/archive-project.js/get-summary.js";
import {
  getProgressHistory,
  getProgressStatistics,
  updateProjectProgress,
} from "../controller/archive-project.js/update-progress.js";
import { requireJe, requireLogin } from "../middlewares/auth.middleware.js";
import {
  handleUploadErrors,
  uploadProgressFiles,
  validateFileUpload,
} from "../middlewares/fileUpload.middleware.js";
import {
  handleValidationErrors,
  progressUpdateRateLimit,
  validateProgressBusinessRules,
  validateProgressFiles,
  validateProgressHistoryQuery,
  validateProgressStatisticsQuery,
  validateProgressUpdate,
} from "../middlewares/validate-archive-project-progress.middleware.js";

const router = express.Router();

// ==========================================
// EXISTING ROUTES
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
// NEW PROGRESS UPDATE ROUTES
// ==========================================

// Get progress statistics across projects
router.get(
  "/progress/statistics",
  requireLogin(),
  validateProgressStatisticsQuery,
  handleValidationErrors,
  getProgressStatistics
);

// Update project progress with file uploads (JE only)
router.put(
  "/:id/progress",
  requireJe(), // Only Junior Engineers can update progress
  progressUpdateRateLimit, // Rate limiting to prevent abuse
  uploadProgressFiles, // Handle file uploads
  handleUploadErrors, // Handle upload errors
  validateProgressFiles, // Validate uploaded files
  validateFileUpload, // Additional file validation (completion requirements)
  validateProgressUpdate, // Validate request body and params
  handleValidationErrors, // Handle validation errors
  validateProgressBusinessRules, // Business logic validation
  updateProjectProgress // Main controller
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

export default router;
