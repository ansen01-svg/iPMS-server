import multer from "multer";
import {
  deleteMultipleFilesFromFirebase,
  processFirebaseFiles,
  uploadMultipleFilesToFirebase,
  validateFile,
} from "../../utils/firebase.js";

// Configure multer to store files in memory for Firebase upload
const storage = multer.memoryStorage();

// File filter function
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

    console.log(`File accepted: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
  } catch (error) {
    console.error("Error in file filter:", error);
    cb(error, false);
  }
};

// Multer configuration for Firebase upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Maximum 10 files per request
  },
});

// NEW: Parse JSON strings in FormData back to objects
/**
 * Parse JSON strings in FormData back to objects
 * This runs after multer has parsed the FormData
 * @param {Object} req - Express request object
 */
const parseFormDataFields = (req) => {
  try {
    console.log("Parsing FormData fields...");

    // Parse geoLocation if it exists and is a string
    if (req.body.geoLocation && typeof req.body.geoLocation === "string") {
      try {
        req.body.geoLocation = JSON.parse(req.body.geoLocation);
        console.log("Parsed geoLocation:", req.body.geoLocation);
      } catch (parseError) {
        console.error("Error parsing geoLocation:", parseError);
        throw new Error("Invalid geoLocation format");
      }
    }

    // Parse subProjects if it exists and is a string
    if (req.body.subProjects && typeof req.body.subProjects === "string") {
      try {
        req.body.subProjects = JSON.parse(req.body.subProjects);
        console.log(`Parsed ${req.body.subProjects.length} subProjects`);
      } catch (parseError) {
        console.error("Error parsing subProjects:", parseError);
        throw new Error("Invalid subProjects format");
      }
    }

    // Convert string boolean values to actual booleans
    if (req.body.hasSubProjects) {
      req.body.hasSubProjects = req.body.hasSubProjects === "true";
    }

    // Convert string numbers to actual numbers for required numeric fields
    const numericFields = ["estimatedCost"];
    numericFields.forEach((field) => {
      if (req.body[field] && typeof req.body[field] === "string") {
        const numericValue = Number(req.body[field]);
        if (!isNaN(numericValue)) {
          req.body[field] = numericValue;
        }
      }
    });

    console.log("FormData parsing completed successfully");
  } catch (error) {
    console.error("Error parsing FormData fields:", error);
    throw error;
  }
};

/**
 * Middleware for uploading files to Firebase Storage
 * @param {string} fieldName - Form field name for files
 * @param {number} maxCount - Maximum number of files
 * @param {string} folder - Firebase storage folder
 */
export const uploadFilesToFirebase = (
  fieldName = "supportingFiles",
  maxCount = 10,
  folder = "uploads"
) => {
  return async (req, res, next) => {
    // First, use multer to parse the multipart form data
    const multerMiddleware = upload.array(fieldName, maxCount);

    multerMiddleware(req, res, async (multerError) => {
      if (multerError) {
        return handleUploadErrors(multerError, req, res, next);
      }

      try {
        // NEW: Parse FormData objects after multer has processed the request
        parseFormDataFields(req);

        // If no files uploaded, continue
        if (!req.files || req.files.length === 0) {
          req.firebaseFiles = [];
          return next();
        }

        // Create folder path based on request context
        const contextFolder = createContextualFolder(req, folder);

        console.log(
          `Uploading ${req.files.length} files to Firebase folder: ${contextFolder}`
        );

        // Upload files to Firebase
        const uploadedFiles = await uploadMultipleFilesToFirebase(
          req.files,
          contextFolder
        );

        // Process and attach to request
        req.firebaseFiles = processFirebaseFiles(uploadedFiles);
        req.uploadedFiles = req.firebaseFiles; // For backward compatibility

        console.log(
          `Successfully uploaded ${uploadedFiles.length} files to Firebase`
        );
        next();
      } catch (error) {
        console.error("Error uploading files to Firebase:", error);

        // NEW: Handle FormData parsing errors
        if (
          error.message.includes("Invalid geoLocation format") ||
          error.message.includes("Invalid subProjects format")
        ) {
          return res.status(400).json({
            success: false,
            message: error.message,
            details: {
              errorCode: "FORMDATA_PARSING_ERROR",
              suggestion:
                "Check that complex objects are properly JSON formatted",
            },
          });
        }

        // Clean up any partially uploaded files
        if (req.firebaseFiles && req.firebaseFiles.length > 0) {
          const filePaths = req.firebaseFiles.map((f) => f.filePath);
          deleteMultipleFilesFromFirebase(filePaths).catch((deleteError) => {
            console.error("Error cleaning up failed uploads:", deleteError);
          });
        }

        return res.status(500).json({
          success: false,
          message: "Failed to upload files to cloud storage",
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
 * Create contextual folder path based on request
 * @param {Object} req - Express request object
 * @param {string} baseFolder - Base folder name
 * @returns {string} - Complete folder path
 */
const createContextualFolder = (req, baseFolder) => {
  const projectId = req.params.id || req.params.projectId || "general";
  const dateFolder = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const updateType = req.route?.path?.includes("financial")
    ? "financial-updates"
    : "progress-updates";

  return `${baseFolder}/${updateType}/${projectId}/${dateFolder}`;
};

/**
 * Enhanced error handling middleware for Firebase uploads
 */
export const handleFirebaseUploadErrors = (error, req, res, next) => {
  console.error("Upload error:", error);

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
          message: "Too many files. Maximum 10 files allowed per upload.",
          details: {
            maxFiles: 10,
            errorCode: "TOO_MANY_FILES",
          },
        });

      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field. Use "supportingFiles" field name.',
          details: {
            expectedFieldName: "supportingFiles",
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
      message: "Cloud storage error occurred during file upload.",
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
 * Validation middleware for file requirements based on update type
 */
export const validateFirebaseFileUpload = (req, res, next) => {
  try {
    const { progress, financialProgress } = req.body;
    const uploadedFiles = req.firebaseFiles || [];

    // Check if completion requires supporting files
    const isProjectComplete = progress && parseFloat(progress) === 100;
    const isFinanciallyComplete =
      financialProgress && parseFloat(financialProgress) === 100;

    if (
      (isProjectComplete || isFinanciallyComplete) &&
      uploadedFiles.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one supporting file is required when marking progress as completed (100%).",
        details: {
          projectProgress: progress || "not provided",
          financialProgress: financialProgress || "not provided",
          filesUploaded: uploadedFiles.length,
          requirement: "Minimum 1 file required for 100% progress",
        },
      });
    }

    // Log successful file processing
    if (uploadedFiles.length > 0) {
      console.log(
        `Successfully processed ${uploadedFiles.length} files for project ${req.params.id}`
      );
      uploadedFiles.forEach((file, index) => {
        console.log(
          `File ${index + 1}: ${file.originalName} (${file.fileSize} bytes)`
        );
      });
    }

    next();
  } catch (error) {
    console.error("Error in Firebase file upload validation:", error);
    return res.status(500).json({
      success: false,
      message: "Error validating file upload",
      details: {
        error: error.message,
      },
    });
  }
};

/**
 * Cleanup middleware to delete uploaded files in case of subsequent errors
 */
export const cleanupFirebaseFiles = async (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;

  // Override response methods to detect errors
  res.send = function (data) {
    if (
      res.statusCode >= 400 &&
      req.firebaseFiles &&
      req.firebaseFiles.length > 0
    ) {
      // Error response, cleanup uploaded files
      const filePaths = req.firebaseFiles.map((f) => f.filePath);
      deleteMultipleFilesFromFirebase(filePaths).catch((error) => {
        console.error(
          "Error cleaning up Firebase files after error response:",
          error
        );
      });
    }
    originalSend.call(this, data);
  };

  res.json = function (data) {
    if (
      res.statusCode >= 400 &&
      req.firebaseFiles &&
      req.firebaseFiles.length > 0
    ) {
      // Error response, cleanup uploaded files
      const filePaths = req.firebaseFiles.map((f) => f.filePath);
      deleteMultipleFilesFromFirebase(filePaths).catch((error) => {
        console.error(
          "Error cleaning up Firebase files after error response:",
          error
        );
      });
    }
    originalJson.call(this, data);
  };

  next();
};

/**
 * Reusable file upload middleware factory
 * @param {Object} options - Upload options
 * @returns {Array} - Array of middleware functions
 */
export const createFileUploadMiddleware = (options = {}) => {
  const {
    fieldName = "supportingFiles",
    maxCount = 10,
    folder = "uploads",
    requireFiles = false,
  } = options;

  const middleware = [
    uploadFilesToFirebase(fieldName, maxCount, folder),
    handleFirebaseUploadErrors,
    validateFirebaseFileUpload,
    cleanupFirebaseFiles,
  ];

  // Add file requirement validation if specified
  if (requireFiles) {
    middleware.push((req, res, next) => {
      if (!req.firebaseFiles || req.firebaseFiles.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one file is required for this operation.",
          details: {
            filesUploaded: 0,
            requirement: "Minimum 1 file required",
          },
        });
      }
      next();
    });
  }

  return middleware;
};

// Export legacy functions for backward compatibility
export const handleUploadErrors = handleFirebaseUploadErrors;
export const processUploadedFiles = (files) => processFirebaseFiles(files);
export const deleteUploadedFiles = async (files) => {
  const filePaths = files.map((f) => f.filePath || f.storageRef);
  return deleteMultipleFilesFromFirebase(filePaths);
};
export const validateFileUpload = validateFirebaseFileUpload;
