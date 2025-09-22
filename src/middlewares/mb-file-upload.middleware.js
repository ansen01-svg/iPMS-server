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

// Multer configuration for single MB upload
const mbUpload = multer({
  storage,
  fileFilter: mbFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 1, // Only one file allowed per MB
  },
});

// Multer configuration for batch MB upload
const mbBatchUpload = multer({
  storage,
  fileFilter: mbFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50, // Maximum 50 files for batch upload
    fieldSize: 50 * 1024 * 1024, // 50MB total field size
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
 * Middleware for uploading multiple MB files to Firebase Storage (Batch Upload)
 */
export const mbBatchFileUpload = async (req, res, next) => {
  // Use multer to parse multiple files
  const multerMiddleware = mbBatchUpload.array("mbFiles", 50);

  multerMiddleware(req, res, async (multerError) => {
    if (multerError) {
      return handleMBUploadErrors(multerError, req, res, next);
    }

    try {
      // Parse measurementBooks from request body
      let measurementBooks;
      try {
        measurementBooks = req.body.measurementBooks
          ? JSON.parse(req.body.measurementBooks)
          : [];
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: "Invalid measurementBooks data format. Must be valid JSON.",
          details: {
            error: parseError.message,
            errorCode: "INVALID_JSON_FORMAT",
          },
        });
      }

      // Validate that we have files and measurementBooks
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one measurement book file is required",
          details: {
            expectedField: "mbFiles",
            allowedTypes: ["PDF", "JPEG", "JPG", "PNG", "WebP"],
          },
        });
      }

      if (!Array.isArray(measurementBooks) || measurementBooks.length === 0) {
        return res.status(400).json({
          success: false,
          message: "measurementBooks must be a non-empty array",
        });
      }

      // Validate that number of files matches number of measurement books
      if (req.files.length !== measurementBooks.length) {
        return res.status(400).json({
          success: false,
          message: `Number of files (${req.files.length}) must match number of measurement books (${measurementBooks.length})`,
          details: {
            filesCount: req.files.length,
            measurementBooksCount: measurementBooks.length,
          },
        });
      }

      console.log(`Processing ${req.files.length} MB files for batch upload`);

      // Group files by project for organized folder structure
      const projectFolders = new Map();
      const uploadPromises = [];

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const mbData = measurementBooks[i];
        const projectId = mbData.project || "general";

        // Create or get folder for this project
        if (!projectFolders.has(projectId)) {
          projectFolders.set(projectId, createMBFolder(projectId));
        }
        const mbFolder = projectFolders.get(projectId);

        // Upload individual file
        uploadPromises.push(
          uploadMultipleFilesToFirebase([file], mbFolder).then(
            (uploadedFiles) => ({
              index: i,
              uploadedFile: uploadedFiles[0],
              projectId,
            })
          )
        );
      }

      // Wait for all uploads to complete
      const uploadResults = await Promise.all(uploadPromises);

      // Process uploaded files and attach to measurement books data
      uploadResults.forEach(({ index, uploadedFile }) => {
        measurementBooks[index].uploadedFile = {
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
      });

      // Attach processed data to request body
      req.body.measurementBooks = measurementBooks;
      req.uploadedFilePaths = uploadResults.map(
        (result) => result.uploadedFile.filePath
      );

      console.log(`Successfully uploaded ${uploadResults.length} MB files`);
      next();
    } catch (error) {
      console.error("Error uploading MB files to Firebase:", error);

      // Cleanup any uploaded files if there was an error
      if (req.uploadedFilePaths && req.uploadedFilePaths.length > 0) {
        deleteMultipleFilesFromFirebase(req.uploadedFilePaths).catch(
          (cleanupError) => {
            console.error(
              "Error cleaning up files after upload failure:",
              cleanupError
            );
          }
        );
      }

      return res.status(500).json({
        success: false,
        message: "Failed to upload measurement book files to cloud storage",
        details: {
          error: error.message,
          errorCode: "FIREBASE_BATCH_UPLOAD_ERROR",
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
          message: "Too many files. Maximum 50 files allowed for batch upload.",
          details: {
            maxFiles: 50,
            errorCode: "TOO_MANY_FILES",
          },
        });

      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message:
            'Use "mbFile" for single upload or "mbFiles" for batch upload.',
          details: {
            singleField: "mbFile",
            batchField: "mbFiles",
            errorCode: "UNEXPECTED_FIELD",
          },
        });

      case "LIMIT_FIELD_VALUE":
      case "LIMIT_FIELD_KEY":
      case "LIMIT_FIELD_COUNT":
        return res.status(400).json({
          success: false,
          message: "Request size too large. Please reduce the amount of data.",
          details: {
            errorCode: "REQUEST_TOO_LARGE",
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
 * Cleanup middleware for MB files in case of errors (Single)
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

/**
 * Cleanup middleware for MB files in case of errors (Batch)
 */
export const cleanupMBBatchFiles = async (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;

  // Override response methods to detect errors
  res.send = function (data) {
    if (
      res.statusCode >= 400 &&
      req.uploadedFilePaths &&
      req.uploadedFilePaths.length > 0
    ) {
      // Error response, cleanup uploaded files
      deleteMultipleFilesFromFirebase(req.uploadedFilePaths).catch((error) => {
        console.error(
          "Error cleaning up MB batch files after error response:",
          error
        );
      });
    }
    originalSend.call(this, data);
  };

  res.json = function (data) {
    if (
      res.statusCode >= 400 &&
      req.uploadedFilePaths &&
      req.uploadedFilePaths.length > 0
    ) {
      // Error response, cleanup uploaded files
      deleteMultipleFilesFromFirebase(req.uploadedFilePaths).catch((error) => {
        console.error(
          "Error cleaning up MB batch files after error response:",
          error
        );
      });
    }
    originalJson.call(this, data);
  };

  next();
};

/**
 * Middleware to process measurementBooks data and convert single MB to array format
 */
export const processMBData = (req, res, next) => {
  try {
    // If measurementBooks is not provided, assume single MB format
    if (!req.body.measurementBooks) {
      // Convert single MB data to array format
      const singleMB = {
        project: req.body.project,
        description: req.body.description,
        remarks: req.body.remarks,
        uploadedFile: req.body.uploadedFile,
      };

      req.body.measurementBooks = [singleMB];
      req.isSingleMB = true; // Flag to indicate this was originally single MB
    } else {
      req.isSingleMB = false;
    }

    next();
  } catch (error) {
    console.error("Error processing MB data:", error);
    res.status(500).json({
      success: false,
      message: "Error processing measurement book data",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
