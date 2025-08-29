import express from "express";
import { exportMBData } from "../controller/mb/export-mb.js";
import createMeasurementBook from "../controller/mb/create-mb.js";
import deleteMeasurementBook from "../controller/mb/delete-mb.js";
import getMeasurementBooks from "../controller/mb/get-all-mbs.js";
import getSingleMeasurementBook from "../controller/mb/get-single-mb.js";
import updateMeasurementBook from "../controller/mb/update-mb.js";
import { requireLogin } from "../middlewares/auth.middleware.js";
import { mbFileUpload } from "../middlewares/mb-file-upload.middleware.js";

const router = express.Router();

// Create a new measurement book (requires login and file upload)
router.post("/", requireLogin(), mbFileUpload, createMeasurementBook);

// Get all measurement books for a specific project
router.get("/project/:projectId", requireLogin(), getMeasurementBooks);

// Export MB data as CSV
router.get("/project/:projectId/export", requireLogin(), exportMBData);

// Get a single measurement book by ID
router.get("/:mbId", requireLogin(), getSingleMeasurementBook);

// Update a measurement book (without file upload)
router.put("/:mbId", requireLogin(), updateMeasurementBook);

// Delete a measurement book
router.delete("/:mbId", requireLogin(), deleteMeasurementBook);

export default router;

// You'll also need to add these routes to your main app.js or server.js file:
// import measurementBookRoutes from "./routes/measurement-book.route.js";
// import fileRoutes from "./routes/file.route.js";
//
// app.use("/api/measurement-books", measurementBookRoutes);
// app.use("/api/files", fileRoutes);
