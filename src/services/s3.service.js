import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import dotenv from "dotenv";
import s3Client from "../config/s3";

// Load environment variables
dotenv.config();

// Constants
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 5MB default

class S3Service {
  // Generate secure filename
  generateFileName(originalName) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString("hex");
    const extension = originalName.split(".").pop();
    return `${timestamp}-${randomString}.${extension}`;
  }

  // Upload file with validation
  async uploadFile(file, folder = "uploads") {
    try {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(
          `File size exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`
        );
      }

      // Validate file type if configured
      if (process.env.ALLOWED_FILE_TYPES) {
        const allowedTypes = process.env.ALLOWED_FILE_TYPES.split(",");
        if (!allowedTypes.includes(file.mimetype)) {
          throw new Error(`File type ${file.mimetype} not allowed`);
        }
      }

      const fileName = this.generateFileName(file.originalname);
      const key = `${folder}/${fileName}`;

      const params = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // ServerSideEncryption: 'AES256', // Enable encryption at rest
        // CacheControl: 'max-age=31536000', // Cache for 1 year
      };

      const command = new PutObjectCommand(params);
      await s3Client.send(command);

      return {
        key,
        url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
        fileName,
      };
    } catch (error) {
      console.error("S3 Upload Error:", error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  // Get presigned URL for private files
  async getPresignedUrl(key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
      console.error("S3 Presigned URL Error:", error);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  // Check if file exists
  async fileExists(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  // Delete file
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error("S3 Delete Error:", error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  // Upload multiple files
  async uploadMultipleFiles(files, folder = "uploads") {
    const uploadPromises = files.map((file) => this.uploadFile(file, folder));
    return await Promise.all(uploadPromises);
  }
}

export default new S3Service();
