import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

/**
 * Create and configure S3 client
 */
const createS3Client = () => {
  if (!process.env.AWS_REGION || !process.env.AWS_BUCKET_NAME) {
    throw new Error("Missing required AWS environment variables");
  }

  const config = {
    region: process.env.AWS_REGION,
  };

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  return new S3Client(config);
};

const s3Client = createS3Client();

export default s3Client;
