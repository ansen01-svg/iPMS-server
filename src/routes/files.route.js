import express from "express";
import fs from "fs";
import path from "path";
import ArchiveProject from "../models/archive-project.model.js";

const router = express.Router();

// Download file endpoint
router.get("/download/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;

    // Find the document in any project
    const project = await ArchiveProject.findOne({
      "progressUpdates.supportingDocuments._id": documentId,
    });

    if (!project) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Find the specific document
    let document = null;
    for (const update of project.progressUpdates) {
      document = update.supportingDocuments.find(
        (doc) => doc._id.toString() === documentId
      );
      if (document) break;
    }

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    const filePath = document.filePath;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on disk" });
    }

    // Set headers for download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.originalName}"`
    );
    res.setHeader("Content-Type", document.mimeType);

    // Send file
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Preview file endpoint
router.get("/preview/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params;

    // Find the document (same logic as download)
    const project = await ArchiveProject.findOne({
      "progressUpdates.supportingDocuments._id": documentId,
    });

    if (!project) {
      return res.status(404).json({ message: "Document not found" });
    }

    let document = null;
    for (const update of project.progressUpdates) {
      document = update.supportingDocuments.find(
        (doc) => doc._id.toString() === documentId
      );
      if (document) break;
    }

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    const filePath = document.filePath;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on disk" });
    }

    // Set headers for inline viewing
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${document.originalName}"`
    );

    // Send file for preview
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error("Preview error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
