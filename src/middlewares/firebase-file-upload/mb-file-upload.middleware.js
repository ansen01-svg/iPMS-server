import multer from "multer";
import {
  deleteMultipleFilesFromFirebase,
  uploadMultipleFilesToFirebase,
  validateFile,
} from "../../utils/firebase.js";

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

// Multer configuration for batch MB upload with multiple files per MB
const mbBatchUpload = multer({
  storage,
  fileFilter: mbFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 500, // Maximum 500 files (50 MBs * 10 measurements per MB average)
    fieldSize: 100 * 1024 * 1024, // 100MB total field size
  },
});

/**
 * Middleware for uploading multiple MB files to Firebase Storage
 * Handles multiple measurement books, each with multiple measurement items
 */
export const mbBatchFileUpload = async (req, res, next) => {
  const multerMiddleware = mbBatchUpload.array("mbFiles", 500);

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

      // Calculate total expected files
      const totalExpectedFiles = measurementBooks.reduce((total, mb) => {
        return total + (mb.measurements?.length || 0);
      }, 0);

      if (req.files.length !== totalExpectedFiles) {
        return res.status(400).json({
          success: false,
          message: `Number of files (${req.files.length}) must match total number of measurements (${totalExpectedFiles})`,
          details: {
            filesCount: req.files.length,
            expectedFilesCount: totalExpectedFiles,
          },
        });
      }

      console.log(
        `Processing ${req.files.length} files for ${measurementBooks.length} measurement book(s)`
      );

      // Upload all files to Firebase
      const uploadPromises = [];
      let fileIndex = 0;

      for (let mbIndex = 0; mbIndex < measurementBooks.length; mbIndex++) {
        const mb = measurementBooks[mbIndex];
        const projectId = mb.project || "general";
        const mbFolder = createMBFolder(projectId);

        if (!mb.measurements || !Array.isArray(mb.measurements)) {
          return res.status(400).json({
            success: false,
            message: `MB ${mbIndex + 1}: measurements must be an array`,
          });
        }

        for (let mIndex = 0; mIndex < mb.measurements.length; mIndex++) {
          const file = req.files[fileIndex];

          if (!file) {
            return res.status(400).json({
              success: false,
              message: `Missing file for MB ${mbIndex + 1}, Measurement ${
                mIndex + 1
              }`,
            });
          }

          uploadPromises.push(
            uploadMultipleFilesToFirebase([file], mbFolder).then(
              (uploadedFiles) => ({
                mbIndex,
                measurementIndex: mIndex,
                uploadedFile: uploadedFiles[0],
              })
            )
          );

          fileIndex++;
        }
      }

      // Wait for all uploads to complete
      const uploadResults = await Promise.all(uploadPromises);

      // Attach uploaded file data to corresponding measurements
      uploadResults.forEach(({ mbIndex, measurementIndex, uploadedFile }) => {
        const measurement =
          measurementBooks[mbIndex].measurements[measurementIndex];

        measurement.uploadedFile = {
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
          message: "Too many files. Maximum 500 files allowed.",
          details: {
            maxFiles: 500,
            errorCode: "TOO_MANY_FILES",
          },
        });

      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: 'Use "mbFiles" field for file uploads.',
          details: {
            expectedField: "mbFiles",
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
 * Cleanup middleware for MB files in case of errors
 */
export const cleanupMBBatchFiles = async (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function (data) {
    if (
      res.statusCode >= 400 &&
      req.uploadedFilePaths &&
      req.uploadedFilePaths.length > 0
    ) {
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
