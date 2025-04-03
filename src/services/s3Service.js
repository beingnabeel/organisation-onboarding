// src/services/s3Service.js
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const path = require("path");
const { logger } = require("../utils/logger");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Get content type based on file extension
 * @param {string} fileName - The file name
 * @returns {string} - The content type
 */
const getContentType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (ext === ".xls") {
    return "application/vnd.ms-excel";
  }
  // Default to xlsx content type
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
};

/**
 * Upload a file to S3
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} fileName - The file name
 * @param {string} orgFolder - The organization folder name
 * @returns {Promise<string>} - The S3 object key
 */
const uploadFile = async (fileBuffer, fileName, orgFolder) => {
  try {
    const key = `${orgFolder}/${fileName}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: getContentType(fileName),
    };

    await s3Client.send(new PutObjectCommand(params));
    logger.info({
      message: "File uploaded successfully to S3",
      metadata: {
        bucket: process.env.AWS_S3_BUCKET_NAME,
        key,
        contentType: params.ContentType,
      },
    });

    return key;
  } catch (error) {
    logger.error({
      message: "Error uploading file to S3",
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Generate a pre-signed URL for a file
 * @param {string} key - The S3 object key
 * @param {number} expiresIn - URL expiration time in seconds
 * @returns {Promise<string>} - The pre-signed URL
 */
const generatePresignedUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    logger.info({
      message: "Pre-signed URL generated successfully",
      metadata: { key },
    });

    return presignedUrl;
  } catch (error) {
    logger.error({
      message: "Error generating pre-signed URL",
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

module.exports = {
  uploadFile,
  generatePresignedUrl,
};
