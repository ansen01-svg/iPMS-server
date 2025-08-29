import crypto from "crypto";
import * as dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import path from "path";

dotenv.config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

/**
 * Generate unique filename with timestamp and random string
 * @param {string} originalName - Original filename
 * @returns {string} - Generated unique filename
 */
const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(6).toString("hex");
  const extension = path.extname(originalName);
  const cleanOriginalName = path
    .basename(originalName, extension)
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 50); // Limit length

  return `${timestamp}-${randomString}-${cleanOriginalName}${extension}`;
};

/**
 * Upload single file to Firebase Storage
 * @param {Object} file - Multer file object
 * @param {string} folder - Storage folder path
 * @returns {Promise<Object>} - Upload result with download URL
 */
export const uploadFileToFirebase = async (file, folder = "uploads") => {
  try {
    if (!file) {
      throw new Error("No file provided");
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error("File size exceeds 10MB limit");
    }

    // Validate file type
    const allowedMimeTypes = [
      // Images
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(
        "Invalid file type. Only images (JPEG, PNG, WebP, GIF) and documents (PDF, DOC, DOCX, XLS, XLSX, TXT) are allowed."
      );
    }

    // Generate unique filename
    const filename = generateUniqueFilename(file.originalname);
    const filePath = `${folder}/${filename}`;

    // Create storage reference
    const storageRef = ref(storage, filePath);

    // Upload file
    const snapshot = await uploadBytes(storageRef, file.buffer, {
      contentType: file.mimetype,
    });

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    // Determine file category
    const fileCategory = file.mimetype.startsWith("image/")
      ? "image"
      : "document";

    console.log(`File uploaded successfully: ${filename} (${file.size} bytes)`);

    return {
      fileName: filename,
      originalName: file.originalname,
      filePath: filePath,
      downloadURL: downloadURL,
      fileSize: file.size,
      mimeType: file.mimetype,
      fileType: fileCategory,
      uploadedAt: new Date(),
      storageRef: filePath, // Store reference for deletion
    };
  } catch (error) {
    console.error("Error uploading file to Firebase:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Upload multiple files to Firebase Storage
 * @param {Array} files - Array of multer file objects
 * @param {string} folder - Storage folder path
 * @returns {Promise<Array>} - Array of upload results
 */
export const uploadMultipleFilesToFirebase = async (
  files,
  folder = "uploads"
) => {
  try {
    if (!files || files.length === 0) {
      return [];
    }

    // Validate total number of files
    if (files.length > 10) {
      throw new Error("Maximum 10 files allowed per upload");
    }

    // Validate total size (50MB limit for all files combined)
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const maxTotalSize = 50 * 1024 * 1024; // 50MB

    if (totalSize > maxTotalSize) {
      throw new Error("Total file size exceeds 50MB limit");
    }

    // Upload all files concurrently
    const uploadPromises = files.map((file, index) =>
      uploadFileToFirebase(file, `${folder}/file_${index + 1}`)
    );

    const uploadResults = await Promise.all(uploadPromises);

    console.log(
      `Successfully uploaded ${uploadResults.length} files to Firebase`
    );

    return uploadResults;
  } catch (error) {
    console.error("Error uploading multiple files:", error);

    // In case of error, attempt to clean up any successfully uploaded files
    // This would require tracking which files were uploaded successfully
    throw new Error(`Failed to upload files: ${error.message}`);
  }
};

/**
 * Delete file from Firebase Storage
 * @param {string} filePath - Storage path of the file to delete
 * @returns {Promise<boolean>} - Success status
 */
export const deleteFileFromFirebase = async (filePath) => {
  try {
    if (!filePath) {
      throw new Error("File path is required");
    }

    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);

    console.log(`File deleted successfully: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);

    // Don't throw error for file not found, just log it
    if (error.code === "storage/object-not-found") {
      console.warn(`File not found for deletion: ${filePath}`);
      return true; // Consider it success since file doesn't exist
    }

    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Delete multiple files from Firebase Storage
 * @param {Array} filePaths - Array of storage paths to delete
 * @returns {Promise<Object>} - Deletion results
 */
export const deleteMultipleFilesFromFirebase = async (filePaths) => {
  try {
    if (!filePaths || filePaths.length === 0) {
      return { success: [], failed: [] };
    }

    const deletionPromises = filePaths.map(async (filePath) => {
      try {
        await deleteFileFromFirebase(filePath);
        return { filePath, success: true };
      } catch (error) {
        return { filePath, success: false, error: error.message };
      }
    });

    const results = await Promise.all(deletionPromises);
    const success = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(
      `File deletion results: ${success.length} successful, ${failed.length} failed`
    );

    return { success, failed };
  } catch (error) {
    console.error("Error in bulk file deletion:", error);
    throw new Error(`Failed to delete files: ${error.message}`);
  }
};

/**
 * Get file download URL from storage path
 * @param {string} filePath - Storage path of the file
 * @returns {Promise<string>} - Download URL
 */
export const getFileDownloadURL = async (filePath) => {
  try {
    if (!filePath) {
      throw new Error("File path is required");
    }

    const fileRef = ref(storage, filePath);
    const downloadURL = await getDownloadURL(fileRef);

    return downloadURL;
  } catch (error) {
    console.error(`Error getting download URL for ${filePath}:`, error);
    throw new Error(`Failed to get download URL: ${error.message}`);
  }
};

/**
 * Validate file before upload (can be used in middleware)
 * @param {Object} file - File to validate
 * @returns {Object} - Validation result
 */
export const validateFile = (file) => {
  const errors = [];
  const warnings = [];

  // Check file existence
  if (!file) {
    errors.push("No file provided");
    return { isValid: false, errors, warnings };
  }

  // Check file size
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    errors.push("File size exceeds 10MB limit");
  }

  if (file.size === 0) {
    errors.push("File is empty");
  }

  // Check file type
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    errors.push("Invalid file type");
  }

  // Warnings for large files
  const warningSize = 5 * 1024 * 1024; // 5MB
  if (file.size > warningSize) {
    warnings.push("Large file size may slow down upload");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Process uploaded files and generate metadata
 * @param {Array} files - Array of uploaded files from Firebase
 * @returns {Array} - Array of processed file metadata
 */
export const processFirebaseFiles = (files) => {
  if (!files || files.length === 0) return [];

  return files.map((file) => ({
    fileName: file.fileName,
    originalName: file.originalName,
    downloadURL: file.downloadURL,
    filePath: file.filePath, // Storage reference for deletion
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    fileType: file.fileType,
    uploadedAt: file.uploadedAt,
    storageRef: file.storageRef,
  }));
};

export default {
  uploadFileToFirebase,
  uploadMultipleFilesToFirebase,
  deleteFileFromFirebase,
  deleteMultipleFilesFromFirebase,
  getFileDownloadURL,
  validateFile,
  processFirebaseFiles,
};
