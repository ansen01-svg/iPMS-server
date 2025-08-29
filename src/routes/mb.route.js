import express from "express";
import createMeasurementBook from "../controller/mb/create-mb.js";
import deleteMeasurementBook from "../controller/mb/delete-mb.js";
import { exportMBData } from "../controller/mb/export-mb.js";
import getAllMeasurementBooks from "../controller/mb/get-all-mbs.js"; // New controller
import getSingleMeasurementBook from "../controller/mb/get-single-mb.js";
import getMeasurementBooks from "../controller/mb/get-single-project-mbs.js";
import updateMeasurementBook from "../controller/mb/update-mb.js";
import { requireLogin } from "../middlewares/auth.middleware.js";
import {
  cleanupMBFile,
  mbFileUpload,
} from "../middlewares/mb-file-upload.middleware.js";

const router = express.Router();

// Get all measurement books across all projects (with optional filters)
router.get("/all", requireLogin(), getAllMeasurementBooks);

// Create a new measurement book (requires login and file upload)
router.post(
  "/",
  requireLogin(),
  mbFileUpload,
  cleanupMBFile,
  createMeasurementBook
);

// Get all measurement books for a specific project
router.get("/project/:projectId", requireLogin(), getMeasurementBooks);

// Export MB data as CSV for a specific project
router.get("/project/:projectId/export", requireLogin(), exportMBData);

// Get a single measurement book by ID
router.get("/:mbId", requireLogin(), getSingleMeasurementBook);

// Update a measurement book (without file upload for now)
router.put("/:mbId", requireLogin(), updateMeasurementBook);

// Delete a measurement book
router.delete("/:mbId", requireLogin(), deleteMeasurementBook);

export default router;

/*
API Endpoints Summary:
====================

POST /api/measurement-books/
- Create a new measurement book
- Requires: Authentication, File upload (mbFile)
- Body: { project, description, remarks }
- File: Single file via 'mbFile' field

GET /api/measurement-books/all
- Get all measurement books across all projects
- Query params: page, limit, sortBy, sortOrder, search, dateFrom, dateTo, hasRemarks, isApproved, projectId
- Includes project-wise statistics and summary

GET /api/measurement-books/project/:projectId
- Get measurement books for a specific project
- Query params: page, limit, sortBy, sortOrder, search, dateFrom, dateTo, hasRemarks, isApproved
- Includes project summary and statistics

GET /api/measurement-books/:mbId
- Get a single measurement book by ID
- Includes project details and computed fields

PUT /api/measurement-books/:mbId
- Update measurement book (description, remarks)
- No file upload in update

DELETE /api/measurement-books/:mbId
- Delete measurement book and associated file

GET /api/measurement-books/project/:projectId/export
- Export project MBs as CSV

Usage in main app:
==================
import measurementBookRoutes from "./routes/mb.route.js";
app.use("/api/measurement-books", measurementBookRoutes);
*/
