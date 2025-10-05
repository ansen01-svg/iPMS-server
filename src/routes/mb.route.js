import express from "express";
import createMeasurementBooks from "../controller/mb/create-mb.js";
import deleteMeasurementBook from "../controller/mb/delete-mb.js";
import { exportMBData } from "../controller/mb/export-mb.js";
import getAllMeasurementBooks from "../controller/mb/get-all-mbs.js";
import getMeasurementBookById from "../controller/mb/get-single-mb.js";
import getMeasurementBooksByProject from "../controller/mb/get-single-project-mbs.js";
import { requireLogin } from "../middlewares/auth.middleware.js";
import {
  cleanupMBBatchFiles,
  mbBatchFileUpload,
} from "../middlewares/mb-file-upload.middleware.js";
import { completeMBValidation } from "../middlewares/validate-mb-data.js";

const router = express.Router();

// Get all measurement books across all projects (with optional filters)
router.get("/all", requireLogin(), getAllMeasurementBooks);

// Batch create measurement books
router.post(
  "/create",
  requireLogin(),
  mbBatchFileUpload,
  cleanupMBBatchFiles,
  completeMBValidation,
  createMeasurementBooks
);

// Get all measurement books for a specific project
router.get("/project/:projectId", requireLogin(), getMeasurementBooksByProject);

// Export MB data as CSV for a specific project
router.get("/project/:projectId/export", requireLogin(), exportMBData);

// Get a single measurement book by ID
router.get("/:mbId", requireLogin(), getMeasurementBookById);

// Delete a measurement book
router.delete("/:mbId", requireLogin(), deleteMeasurementBook);

export default router;
