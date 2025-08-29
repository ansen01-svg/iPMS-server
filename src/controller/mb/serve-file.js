import fs from "fs";
import path from "path";
import MeasurementBook from "../../models/mb.model.js";

const serveFile = async (req, res) => {
  try {
    const { fileName } = req.params;

    // Find the measurement book with this file
    const measurementBook = await MeasurementBook.findOne({
      "uploadedFile.fileName": fileName,
    });

    if (!measurementBook) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    const filePath = measurementBook.uploadedFile.filePath;

    // Check if file exists on disk
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found on server",
      });
    }

    // Set appropriate headers
    const fileExtension = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
    };

    const mimeType = mimeTypes[fileExtension] || "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${measurementBook.uploadedFile.originalName}"`
    );

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error serving file:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default serveFile;
