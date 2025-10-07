// src/middlewares/query-file-upload.middleware.js

import multer from "multer";
import {
  deleteMultipleFilesFromFirebase,
  processFirebaseFiles,
  uploadMultipleFilesToFirebase,
  validateFile,
} from "../../utils/firebase.js";

// Configure multer to store files in memory for Firebase upload
const storage = multer.memoryStorage();

// File filter function for query attachments
const fileFilter = (req, file, cb) => {
  try {
    const validation = validateFile(file);

    if (!validation.isValid) {
      const error = new Error(validation.errors.join(", "));
      error.code = "INVALID_FILE";
      return cb(error, false);
    }

    // Add file category for later use
    const fileCategory = file.mimetype.startsWith("image/")
      ? "image"
      : "document";
    file.fileCategory = fileCategory;

    console.log(`Query file accepted: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
  } catch (error) {
    console.error("Error in query file filter:", error);
    cb(error, false);
  }
};

// Multer configuration for query file uploads
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Maximum 5 files per query update
  },
});

/**
 * Create contextual folder path for query files
 * @param {Object} req - Express request object
 * @returns {string} - Complete folder path
 */
const createQueryFileFolder = (req) => {
  const queryId = req.params.queryId || "unknown";
  const dateFolder = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  return `query-attachments/${queryId}/${dateFolder}`;
};

/**
 * Middleware for uploading query attachment files to Firebase Storage
 * @param {string} fieldName - Form field name for files (default: "attachments")
 * @param {number} maxCount - Maximum number of files (default: 5)
 */
export const uploadQueryFiles = (fieldName = "attachments", maxCount = 5) => {
  return async (req, res, next) => {
    // First, use multer to parse the multipart form data
    const multerMiddleware = upload.array(fieldName, maxCount);

    multerMiddleware(req, res, async (multerError) => {
      if (multerError) {
        return handleQueryUploadErrors(multerError, req, res, next);
      }

      try {
        // If no files uploaded, continue
        if (!req.files || req.files.length === 0) {
          req.queryFiles = [];
          return next();
        }

        // Create folder path for query files
        const queryFolder = createQueryFileFolder(req);

        console.log(
          `Uploading ${req.files.length} query files to Firebase folder: ${queryFolder}`
        );

        // Upload files to Firebase
        const uploadedFiles = await uploadMultipleFilesToFirebase(
          req.files,
          queryFolder
        );

        // Process and attach to request
        req.queryFiles = processFirebaseFiles(uploadedFiles);

        console.log(
          `Successfully uploaded ${uploadedFiles.length} query files to Firebase`
        );
        next();
      } catch (error) {
        console.error("Error uploading query files to Firebase:", error);

        // Clean up any partially uploaded files
        if (req.queryFiles && req.queryFiles.length > 0) {
          const filePaths = req.queryFiles.map((f) => f.filePath);
          deleteMultipleFilesFromFirebase(filePaths).catch((deleteError) => {
            console.error(
              "Error cleaning up failed query uploads:",
              deleteError
            );
          });
        }

        return res.status(500).json({
          success: false,
          message: "Failed to upload query attachment files to cloud storage",
          details: {
            error: error.message,
            errorCode: "FIREBASE_UPLOAD_ERROR",
          },
        });
      }
    });
  };
};

/**
 * Error handling middleware for query file uploads
 */
export const handleQueryUploadErrors = (error, req, res, next) => {
  console.error("Query upload error:", error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message:
            "File size too large. Maximum size allowed is 10MB per file.",
          details: {
            maxSize: "10MB",
            errorCode: "FILE_TOO_LARGE",
          },
        });

      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          message: "Too many files. Maximum 5 files allowed per query update.",
          details: {
            maxFiles: 5,
            errorCode: "TOO_MANY_FILES",
          },
        });

      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field. Use "attachments" field name.',
          details: {
            expectedFieldName: "attachments",
            errorCode: "UNEXPECTED_FIELD",
          },
        });

      default:
        return res.status(400).json({
          success: false,
          message: "Query file upload error occurred.",
          details: {
            error: error.message,
            errorCode: "UPLOAD_ERROR",
          },
        });
    }
  } else if (error && error.code === "INVALID_FILE") {
    return res.status(400).json({
      success: false,
      message: error.message,
      details: {
        allowedTypes: {
          images: ["JPEG", "JPG", "PNG", "WebP", "GIF"],
          documents: ["PDF", "DOC", "DOCX", "XLS", "XLSX", "TXT"],
        },
        errorCode: "INVALID_FILE_TYPE",
      },
    });
  } else if (error && error.message.includes("Firebase")) {
    return res.status(500).json({
      success: false,
      message: "Cloud storage error occurred during query file upload.",
      details: {
        errorCode: "FIREBASE_STORAGE_ERROR",
        suggestion:
          "Please try again or contact administrator if the problem persists.",
      },
    });
  }

  next(error);
};

/**
 * Cleanup middleware to delete uploaded query files in case of subsequent errors
 */
export const cleanupQueryFiles = async (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;

  // Override response methods to detect errors
  res.send = function (data) {
    if (res.statusCode >= 400 && req.queryFiles && req.queryFiles.length > 0) {
      // Error response, cleanup uploaded files
      const filePaths = req.queryFiles.map((f) => f.filePath);
      deleteMultipleFilesFromFirebase(filePaths).catch((error) => {
        console.error(
          "Error cleaning up query files after error response:",
          error
        );
      });
    }
    originalSend.call(this, data);
  };

  res.json = function (data) {
    if (res.statusCode >= 400 && req.queryFiles && req.queryFiles.length > 0) {
      // Error response, cleanup uploaded files
      const filePaths = req.queryFiles.map((f) => f.filePath);
      deleteMultipleFilesFromFirebase(filePaths).catch((error) => {
        console.error(
          "Error cleaning up query files after error response:",
          error
        );
      });
    }
    originalJson.call(this, data);
  };

  next();
};

/**
 * Complete middleware chain for query file uploads
 */
export const queryFileUploadMiddleware = [
  uploadQueryFiles("attachments", 5),
  handleQueryUploadErrors,
  cleanupQueryFiles,
];

export default queryFileUploadMiddleware;
