import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "crypto";
import s3Client from "../config/s3.js";

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION;

/**
 * Validate uploaded file (supports both images and documents)
 */
export const validateFile = (file, options = {}) => {
  const errors = [];
  const maxSize = options.maxSize || 10 * 1024 * 1024; // Default 10MB

  // Default allowed types - images and PDFs
  const defaultAllowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ];

  const allowedMimeTypes = options.allowedMimeTypes || defaultAllowedTypes;

  // Check file size
  if (file.size > maxSize) {
    errors.push(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
  }

  // Check mime type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    errors.push(
      `Invalid file type. Allowed types: ${allowedMimeTypes.join(", ")}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Generate secure filename
 */
const generateSecureFilename = (originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const extension = originalName.split(".").pop();
  return `${timestamp}-${randomString}.${extension}`;
};

/**
 * Upload multiple files to S3
 */
export const uploadMultipleFilesToS3 = async (files, folder = "uploads") => {
  try {
    const uploadPromises = files.map(async (file) => {
      const fileName = generateSecureFilename(file.originalname);
      const key = `${folder}/${fileName}`;

      const params = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // ServerSideEncryption: 'AES256', // Enable if you want encryption
      };

      const command = new PutObjectCommand(params);
      await s3Client.send(command);

      return {
        originalName: file.originalname,
        fileName,
        key,
        size: file.size,
        mimetype: file.mimetype,
      };
    });

    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error("Error uploading files to S3:", error);
    throw new Error(`S3 upload failed: ${error.message}`);
  }
};

/**
 * Process S3 files to add download URLs
 */
export const processS3Files = (uploadedFiles) => {
  return uploadedFiles.map((file) => ({
    ...file,
    downloadURL: `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${file.key}`,
    filePath: file.key, // For deletion purposes
  }));
};

/**
 * Delete multiple files from S3
 */
export const deleteMultipleFilesFromS3 = async (filePaths) => {
  try {
    if (!filePaths || filePaths.length === 0) {
      return;
    }

    // If only one file, use DeleteObjectCommand
    if (filePaths.length === 1) {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filePaths[0],
      });
      await s3Client.send(command);
      console.log(`Deleted file from S3: ${filePaths[0]}`);
      return;
    }

    // For multiple files, use DeleteObjectsCommand
    const objects = filePaths.map((path) => ({ Key: path }));

    const command = new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: objects,
        Quiet: false,
      },
    });

    const response = await s3Client.send(command);

    if (response.Deleted) {
      console.log(`Deleted ${response.Deleted.length} files from S3`);
    }
    if (response.Errors) {
      console.error("Some files failed to delete:", response.Errors);
    }
  } catch (error) {
    console.error("Error deleting files from S3:", error);
    throw new Error(`S3 deletion failed: ${error.message}`);
  }
};

/**
 * Delete single file from S3
 */
export const deleteFileFromS3 = async (filePath) => {
  return deleteMultipleFilesFromS3([filePath]);
};
