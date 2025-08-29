// src/middlewares/file-upload.middleware.js
import fs from "fs";
import multer from "multer";
import path from "path";

// Ensure upload directory exists
const uploadDir = "uploads/measurement-books";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    const fileName = `mb-${uniqueSuffix}${fileExtension}`;
    cb(null, fileName);
  },
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, JPG, JPEG, and PNG files are allowed"), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: fileFilter,
});

// Middleware to handle single file upload for MB
export const uploadMBFile = upload.single("mbFile");

// Error handling middleware for multer
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size allowed is 50MB",
      });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected field name. Please use 'mbFile' as the field name",
      });
    }
  }

  if (
    error.message.includes("Only PDF, JPG, JPEG, and PNG files are allowed")
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed",
    });
  }

  next(error);
};

// Middleware to process uploaded file and add to req.body
export const processUploadedFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  // Get file extension to determine type
  const fileExtension = path
    .extname(req.file.originalname)
    .toLowerCase()
    .slice(1);

  // Add file details to req.body for controller to use
  req.body.uploadedFile = {
    fileName: req.file.filename,
    originalName: req.file.originalname,
    fileType: fileExtension,
    fileSize: req.file.size,
    filePath: req.file.path,
    mimeType: req.file.mimetype,
  };

  next();
};

// Combined middleware for MB file upload
export const mbFileUpload = [
  uploadMBFile,
  handleUploadError,
  processUploadedFile,
];

// Utility function to delete uploaded file (useful for cleanup on errors)
export const deleteUploadedFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
  }
};
