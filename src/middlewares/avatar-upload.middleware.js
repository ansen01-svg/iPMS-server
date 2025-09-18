import multer from "multer";
import {
  deleteMultipleFilesFromFirebase,
  processFirebaseFiles,
  uploadMultipleFilesToFirebase,
  validateFile,
} from "../utils/firebase.js";

// Configure multer for avatar upload (memory storage)
const storage = multer.memoryStorage();

// File filter specifically for avatar images
const avatarFileFilter = (req, file, cb) => {
  try {
    // Only allow image files for avatars
    if (!file.mimetype.startsWith("image/")) {
      const error = new Error("Only image files are allowed for avatar upload");
      error.code = "INVALID_AVATAR_FILE";
      return cb(error, false);
    }

    // Use existing validation function
    const validation = validateFile(file);

    if (!validation.isValid) {
      const error = new Error(validation.errors.join(", "));
      error.code = "INVALID_FILE";
      return cb(error, false);
    }

    console.log(
      `Avatar file accepted: ${file.originalname} (${file.mimetype})`
    );
    cb(null, true);
  } catch (error) {
    console.error("Error in avatar file filter:", error);
    cb(error, false);
  }
};

// Multer configuration for avatar upload
const avatarUpload = multer({
  storage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for avatar
    files: 1, // Only one file allowed
  },
});

/**
 * Middleware for uploading avatar to Firebase Storage
 * Uploads single image file and adds the URL to req.body.avatar
 */
export const uploadAvatarToFirebase = async (req, res, next) => {
  // Use multer to handle the single file upload
  const multerMiddleware = avatarUpload.single("avatar");

  multerMiddleware(req, res, async (multerError) => {
    if (multerError) {
      return handleAvatarUploadErrors(multerError, req, res, next);
    }

    try {
      // If no file uploaded, continue (avatar update is optional)
      if (!req.file) {
        return next();
      }

      console.log("Processing avatar upload...");

      // Create folder path for avatars
      const userId = req.user?.userId || req.user?.id || "unknown";
      const avatarFolder = `avatars/${userId}`;

      console.log(`Uploading avatar to Firebase folder: ${avatarFolder}`);

      // Upload single file to Firebase
      const uploadedFiles = await uploadMultipleFilesToFirebase(
        [req.file], // Convert single file to array
        avatarFolder
      );

      if (uploadedFiles.length > 0) {
        // Process the uploaded file
        const processedFiles = processFirebaseFiles(uploadedFiles);
        const avatarFile = processedFiles[0];

        // Add the avatar URL to request body for controller to use
        req.body.avatar = avatarFile.downloadURL;

        // Store file info for potential cleanup
        req.uploadedAvatarFile = avatarFile;

        console.log(`Avatar uploaded successfully: ${avatarFile.downloadURL}`);
      }

      next();
    } catch (error) {
      console.error("Error uploading avatar to Firebase:", error);

      // Clean up any partially uploaded files
      if (req.uploadedAvatarFile) {
        deleteMultipleFilesFromFirebase([
          req.uploadedAvatarFile.filePath,
        ]).catch((deleteError) => {
          console.error("Error cleaning up failed avatar upload:", deleteError);
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to upload avatar to cloud storage",
        details: {
          error: error.message,
          errorCode: "FIREBASE_AVATAR_UPLOAD_ERROR",
        },
      });
    }
  });
};

/**
 * Error handling middleware for avatar uploads
 */
export const handleAvatarUploadErrors = (error, req, res, next) => {
  console.error("Avatar upload error:", error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message: "Avatar file size too large. Maximum size allowed is 5MB.",
          details: {
            maxSize: "5MB",
            errorCode: "AVATAR_FILE_TOO_LARGE",
          },
        });

      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          message: "Only one avatar file is allowed.",
          details: {
            maxFiles: 1,
            errorCode: "TOO_MANY_AVATAR_FILES",
          },
        });

      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message:
            'Unexpected file field. Use "avatar" field name for avatar upload.',
          details: {
            expectedFieldName: "avatar",
            errorCode: "UNEXPECTED_AVATAR_FIELD",
          },
        });

      default:
        return res.status(400).json({
          success: false,
          message: "Avatar upload error occurred.",
          details: {
            error: error.message,
            errorCode: "AVATAR_UPLOAD_ERROR",
          },
        });
    }
  } else if (error && error.code === "INVALID_AVATAR_FILE") {
    return res.status(400).json({
      success: false,
      message: error.message,
      details: {
        allowedTypes: ["JPEG", "JPG", "PNG", "WebP", "GIF"],
        errorCode: "INVALID_AVATAR_FILE_TYPE",
      },
    });
  } else if (error && error.code === "INVALID_FILE") {
    return res.status(400).json({
      success: false,
      message: error.message,
      details: {
        allowedTypes: ["JPEG", "JPG", "PNG", "WebP", "GIF"],
        errorCode: "INVALID_FILE_TYPE",
      },
    });
  } else if (error && error.message.includes("Firebase")) {
    return res.status(500).json({
      success: false,
      message: "Cloud storage error occurred during avatar upload.",
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
 * Cleanup middleware for avatar uploads in case of errors
 */
export const cleanupAvatarFile = async (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;

  // Override response methods to detect errors
  res.send = function (data) {
    if (res.statusCode >= 400 && req.uploadedAvatarFile) {
      // Error response, cleanup uploaded avatar
      deleteMultipleFilesFromFirebase([req.uploadedAvatarFile.filePath]).catch(
        (error) => {
          console.error(
            "Error cleaning up avatar file after error response:",
            error
          );
        }
      );
    }
    originalSend.call(this, data);
  };

  res.json = function (data) {
    if (res.statusCode >= 400 && req.uploadedAvatarFile) {
      // Error response, cleanup uploaded avatar
      deleteMultipleFilesFromFirebase([req.uploadedAvatarFile.filePath]).catch(
        (error) => {
          console.error(
            "Error cleaning up avatar file after error response:",
            error
          );
        }
      );
    }
    originalJson.call(this, data);
  };

  next();
};
