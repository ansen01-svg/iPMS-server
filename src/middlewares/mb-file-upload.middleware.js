import multer from "multer";
import {
  deleteMultipleFilesFromFirebase,
  uploadMultipleFilesToFirebase,
  validateFile,
} from "../utils/firebase.js";

// Configure multer to store files in memory for Firebase upload
const storage = multer.memoryStorage();

// File filter function for MB files
const mbFileFilter = (req, file, cb) => {
  try {
    const validation = validateFile(file);

    if (!validation.isValid) {
      const error = new Error(validation.errors.join(", "));
      error.code = "INVALID_FILE";
      return cb(error, false);
    }

    // Specific validation for MB files - only allow PDF and images
    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      const error = new Error(
        "Only PDF, JPEG, JPG, PNG, and WebP files are allowed for Measurement Books"
      );
      error.code = "INVALID_FILE_TYPE";
      return cb(error, false);
    }

    // Add file category for later use
    const fileCategory = file.mimetype.startsWith("image/")
      ? "image"
      : "document";
    file.fileCategory = fileCategory;

    console.log(`MB File accepted: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
  } catch (error) {
    console.error("Error in MB file filter:", error);
    cb(error, false);
  }
};

// Multer configuration specifically for MB uploads
const mbUpload = multer({
  storage,
  fileFilter: mbFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 1, // Only one file allowed per MB
  },
});

/**
 * Middleware for uploading single MB file to Firebase Storage
 */
export const mbFileUpload = async (req, res, next) => {
  // Use multer to parse the single file
  const multerMiddleware = mbUpload.single("mbFile");

  multerMiddleware(req, res, async (multerError) => {
    if (multerError) {
      return handleMBUploadErrors(multerError, req, res, next);
    }

    try {
      // File is required for MB creation
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Measurement Book file is required",
          details: {
            expectedField: "mbFile",
            allowedTypes: ["PDF", "JPEG", "JPG", "PNG", "WebP"],
          },
        });
      }

      // Create folder path for MB files
      const projectId = req.body.project || "general";
      const mbFolder = createMBFolder(projectId);

      console.log(`Uploading MB file to Firebase folder: ${mbFolder}`);

      // Upload file to Firebase (single file)
      const uploadedFiles = await uploadMultipleFilesToFirebase(
        [req.file],
        mbFolder
      );

      if (!uploadedFiles || uploadedFiles.length === 0) {
        throw new Error("Failed to upload file to Firebase");
      }

      const uploadedFile = uploadedFiles[0];

      // Process and attach to request body for controller use
      req.body.uploadedFile = {
        fileName: uploadedFile.fileName,
        originalName: uploadedFile.originalName,
        downloadURL: uploadedFile.downloadURL,
        filePath: uploadedFile.filePath,
        fileSize: uploadedFile.fileSize,
        mimeType: uploadedFile.mimeType,
        fileType: uploadedFile.mimeType.startsWith("image/")
          ? "image"
          : "document",
      };

      console.log(
        `Successfully uploaded MB file: ${uploadedFile.originalName}`
      );
      next();
    } catch (error) {
      console.error("Error uploading MB file to Firebase:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to upload measurement book file to cloud storage",
        details: {
          error: error.message,
          errorCode: "FIREBASE_UPLOAD_ERROR",
        },
      });
    }
  });
};

/**
 * Create folder path for MB files
 * @param {string} projectId - Project ID
 * @returns {string} - Complete folder path
 */
const createMBFolder = (projectId) => {
  const dateFolder = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `measurement-books/${projectId}/${dateFolder}`;
};

/**
 * Error handling for MB file uploads
 */
const handleMBUploadErrors = (error, req, res, next) => {
  console.error("MB Upload error:", error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message: "File size too large. Maximum size allowed is 10MB.",
          details: {
            maxSize: "10MB",
            errorCode: "FILE_TOO_LARGE",
          },
        });

      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: 'Use "mbFile" field name for measurement book file upload.',
          details: {
            expectedFieldName: "mbFile",
            errorCode: "UNEXPECTED_FIELD",
          },
        });

      default:
        return res.status(400).json({
          success: false,
          message: "File upload error occurred.",
          details: {
            error: error.message,
            errorCode: "UPLOAD_ERROR",
          },
        });
    }
  } else if (error && error.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({
      success: false,
      message: error.message,
      details: {
        allowedTypes: ["PDF", "JPEG", "JPG", "PNG", "WebP"],
        errorCode: "INVALID_FILE_TYPE",
      },
    });
  } else if (error && error.code === "INVALID_FILE") {
    return res.status(400).json({
      success: false,
      message: error.message,
      details: {
        allowedTypes: ["PDF", "JPEG", "JPG", "PNG", "WebP"],
        errorCode: "INVALID_FILE",
      },
    });
  }

  next(error);
};

/**
 * Cleanup middleware for MB files in case of errors
 */
export const cleanupMBFile = async (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;

  // Override response methods to detect errors
  res.send = function (data) {
    if (res.statusCode >= 400 && req.body.uploadedFile) {
      // Error response, cleanup uploaded file
      deleteMultipleFilesFromFirebase([req.body.uploadedFile.filePath]).catch(
        (error) => {
          console.error(
            "Error cleaning up MB file after error response:",
            error
          );
        }
      );
    }
    originalSend.call(this, data);
  };

  res.json = function (data) {
    if (res.statusCode >= 400 && req.body.uploadedFile) {
      // Error response, cleanup uploaded file
      deleteMultipleFilesFromFirebase([req.body.uploadedFile.filePath]).catch(
        (error) => {
          console.error(
            "Error cleaning up MB file after error response:",
            error
          );
        }
      );
    }
    originalJson.call(this, data);
  };

  next();
};
