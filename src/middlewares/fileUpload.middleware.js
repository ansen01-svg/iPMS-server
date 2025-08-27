// import crypto from "crypto";
// import fs from "fs";
// import multer from "multer";
// import path from "path";

// // Create uploads directory if it doesn't exist
// const uploadsDir = "uploads/progress-updates";
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir, { recursive: true });
// }

// // Storage configuration
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const { projectId } = req.params;
//     const dateFolder = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
//     const finalDestination = path.join(uploadsDir, projectId, dateFolder);

//     // Create directory if it doesn't exist
//     if (!fs.existsSync(finalDestination)) {
//       fs.mkdirSync(finalDestination, { recursive: true });
//     }

//     cb(null, finalDestination);
//   },
//   filename: (req, file, cb) => {
//     // Generate unique filename with timestamp and random string
//     const timestamp = Date.now();
//     const randomString = crypto.randomBytes(6).toString("hex");
//     const extension = path.extname(file.originalname);
//     const filename = `${timestamp}-${randomString}${extension}`;
//     cb(null, filename);
//   },
// });

// // File filter function
// const fileFilter = (req, file, cb) => {
//   // Allowed file types
//   const allowedImageTypes = [
//     "image/jpeg",
//     "image/jpg",
//     "image/png",
//     "image/webp",
//   ];
//   const allowedDocumentTypes = [
//     "application/pdf",
//     "application/msword",
//     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//     "application/vnd.ms-excel",
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//     "text/plain",
//   ];

//   const isImage = allowedImageTypes.includes(file.mimetype);
//   const isDocument = allowedDocumentTypes.includes(file.mimetype);

//   if (isImage || isDocument) {
//     // Add file type to request for later use
//     file.fileCategory = isImage ? "image" : "document";
//     cb(null, true);
//   } else {
//     const error = new Error(
//       "Invalid file type. Only images (JPEG, PNG, WebP) and documents (PDF, DOC, DOCX, XLS, XLSX, TXT) are allowed."
//     );
//     error.code = "INVALID_FILE_TYPE";
//     cb(error, false);
//   }
// };

// // Multer configuration
// const upload = multer({
//   storage,
//   fileFilter,
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10MB per file
//     files: 10, // Maximum 10 files per request
//   },
// });

// // Middleware for progress update file uploads
// export const uploadProgressFiles = upload.array("supportingFiles", 10);

// // Error handling middleware for multer
// export const handleUploadErrors = (error, req, res, next) => {
//   if (error instanceof multer.MulterError) {
//     switch (error.code) {
//       case "LIMIT_FILE_SIZE":
//         return res.status(400).json({
//           success: false,
//           message:
//             "File size too large. Maximum size allowed is 10MB per file.",
//           details: {
//             maxSize: "10MB",
//             errorCode: "FILE_TOO_LARGE",
//           },
//         });

//       case "LIMIT_FILE_COUNT":
//         return res.status(400).json({
//           success: false,
//           message: "Too many files. Maximum 10 files allowed per upload.",
//           details: {
//             maxFiles: 10,
//             errorCode: "TOO_MANY_FILES",
//           },
//         });

//       case "LIMIT_UNEXPECTED_FILE":
//         return res.status(400).json({
//           success: false,
//           message: 'Unexpected file field. Use "supportingFiles" field name.',
//           details: {
//             expectedFieldName: "supportingFiles",
//             errorCode: "UNEXPECTED_FIELD",
//           },
//         });

//       default:
//         return res.status(400).json({
//           success: false,
//           message: "File upload error occurred.",
//           details: {
//             error: error.message,
//             errorCode: "UPLOAD_ERROR",
//           },
//         });
//     }
//   } else if (error && error.code === "INVALID_FILE_TYPE") {
//     return res.status(400).json({
//       success: false,
//       message: error.message,
//       details: {
//         allowedTypes: {
//           images: ["JPEG", "JPG", "PNG", "WebP"],
//           documents: ["PDF", "DOC", "DOCX", "XLS", "XLSX", "TXT"],
//         },
//         errorCode: "INVALID_FILE_TYPE",
//       },
//     });
//   }

//   next(error);
// };

// // Utility function to process uploaded files
// export const processUploadedFiles = (files) => {
//   if (!files || files.length === 0) return [];

//   return files.map((file) => ({
//     fileName: file.filename,
//     originalName: file.originalname,
//     filePath: file.path,
//     fileSize: file.size,
//     mimeType: file.mimetype,
//     fileType: file.fileCategory, // 'image' or 'document'
//     uploadedAt: new Date(),
//   }));
// };

// // Utility function to delete uploaded files (in case of error)
// export const deleteUploadedFiles = (files) => {
//   if (!files || files.length === 0) return;

//   files.forEach((file) => {
//     try {
//       if (fs.existsSync(file.path)) {
//         fs.unlinkSync(file.path);
//       }
//     } catch (error) {
//       console.error(`Failed to delete file ${file.path}:`, error);
//     }
//   });
// };

// // Validation middleware for file requirements
// export const validateFileUpload = (req, res, next) => {
//   const { progress } = req.body;

//   // If progress is being updated to 100% (completed), require at least one file
//   if (parseInt(progress) === 100 && (!req.files || req.files.length === 0)) {
//     return res.status(400).json({
//       success: false,
//       message:
//         "At least one supporting file is required when marking project as completed (100% progress).",
//       details: {
//         currentProgress: progress,
//         filesUploaded: req.files ? req.files.length : 0,
//         requirement: "Minimum 1 file required for 100% progress",
//       },
//     });
//   }

//   next();
// };

// middlewares/fileUpload.middleware.js (FIXED VERSION)
import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), "uploads", "progress-updates");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const projectId = req.params.id; // Use 'id' instead of 'projectId' from params
      const dateFolder = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const finalDestination = path.join(uploadsDir, projectId, dateFolder);

      // Create directory if it doesn't exist
      if (!fs.existsSync(finalDestination)) {
        fs.mkdirSync(finalDestination, { recursive: true });
      }

      console.log(`File destination: ${finalDestination}`); // Debug log
      cb(null, finalDestination);
    } catch (error) {
      console.error("Error creating destination directory:", error);
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    try {
      // Generate unique filename with timestamp and random string
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(6).toString("hex");
      const extension = path.extname(file.originalname);
      const cleanOriginalName = path
        .basename(file.originalname, extension)
        .replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `${timestamp}-${randomString}-${cleanOriginalName}${extension}`;

      console.log(`Generated filename: ${filename}`); // Debug log
      cb(null, filename);
    } catch (error) {
      console.error("Error generating filename:", error);
      cb(error, null);
    }
  },
});

// File filter function
const fileFilter = (req, file, cb) => {
  try {
    // Allowed file types
    const allowedImageTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    const allowedDocumentTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ];

    const isImage = allowedImageTypes.includes(file.mimetype);
    const isDocument = allowedDocumentTypes.includes(file.mimetype);

    if (isImage || isDocument) {
      // Add file type to request for later use
      file.fileCategory = isImage ? "image" : "document";
      console.log(`File accepted: ${file.originalname} (${file.mimetype})`); // Debug log
      cb(null, true);
    } else {
      const error = new Error(
        "Invalid file type. Only images (JPEG, PNG, WebP, GIF) and documents (PDF, DOC, DOCX, XLS, XLSX, TXT) are allowed."
      );
      error.code = "INVALID_FILE_TYPE";
      cb(error, false);
    }
  } catch (error) {
    console.error("Error in file filter:", error);
    cb(error, false);
  }
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Maximum 10 files per request
  },
});

// Middleware for progress update file uploads
export const uploadProgressFiles = upload.array("supportingFiles", 10);

// Enhanced error handling middleware for multer
export const handleUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error("Multer error:", error);

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
  } else if (error && error.code === "INVALID_FILE_TYPE") {
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
  } else if (error) {
    console.error("General upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during file upload",
      details: {
        errorCode: "INTERNAL_UPLOAD_ERROR",
      },
    });
  }

  next();
};

// Enhanced utility function to process uploaded files with better error handling
export const processUploadedFiles = (files) => {
  if (!files || files.length === 0) return [];

  return files.map((file) => {
    // Validate required file properties
    if (!file.filename || !file.originalname || !file.path) {
      console.error("File missing required properties:", file);
      throw new Error(`Invalid file data - missing required properties`);
    }

    return {
      fileName: file.filename,
      originalName: file.originalname,
      filePath: file.path,
      fileSize: file.size || 0,
      mimeType: file.mimetype || "application/octet-stream",
      fileType: file.fileCategory || "document", // 'image' or 'document'
      uploadedAt: new Date(),
    };
  });
};

// Enhanced utility function to delete uploaded files
export const deleteUploadedFiles = (files) => {
  if (!files || files.length === 0) return;

  files.forEach((file) => {
    try {
      const filePath = file.path;
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to delete file ${file.path}:`, error);
    }
  });
};

// Enhanced validation middleware for file requirements
export const validateFileUpload = (req, res, next) => {
  try {
    const { progress } = req.body;
    const progressNum = parseFloat(progress);

    // If progress is being updated to 100% (completed), require at least one file
    if (progressNum === 100 && (!req.files || req.files.length === 0)) {
      return res.status(400).json({
        success: false,
        message:
          "At least one supporting file is required when marking project as completed (100% progress).",
        details: {
          currentProgress: progress,
          filesUploaded: req.files ? req.files.length : 0,
          requirement: "Minimum 1 file required for 100% progress",
        },
      });
    }

    // Log successful file processing for debugging
    if (req.files && req.files.length > 0) {
      console.log(
        `Successfully processed ${req.files.length} files for project ${req.params.id}`
      );
      req.files.forEach((file, index) => {
        console.log(
          `File ${index + 1}: ${file.originalname} (${file.size} bytes) at ${
            file.path
          }`
        );
      });
    }

    next();
  } catch (error) {
    console.error("Error in file upload validation:", error);
    return res.status(500).json({
      success: false,
      message: "Error validating file upload",
      details: {
        error: error.message,
      },
    });
  }
};
