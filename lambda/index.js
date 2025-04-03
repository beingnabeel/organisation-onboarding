/**
 * AWS Lambda handler for triggering ETL process when Excel files are uploaded to S3
 */
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const fs = require('fs');
const path = require('path');
const { runEtl } = require('./etlInjestion');
const logger = require('./utils/logger');

exports.handler = async (event, context) => {
  try {
    // Log the event for debugging
    logger.info({
      message: 'Received S3 event',
      metadata: { event: JSON.stringify(event) }
    });
    
    // Get the S3 bucket and key from the event
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    
    // Extract organization name from the path
    // Assuming path is like: "organizationName/tenant-onboarding-organizationName.xlsx"
    const folderName = key.split('/')[0];
    
    logger.info({
      message: `Processing Excel for organization: ${folderName}`,
      metadata: { bucket, key }
    });
    
    // Download the Excel file from S3
    const downloadPath = `/tmp/${path.basename(key)}`;
    await downloadFromS3(bucket, key, downloadPath);
    
    logger.info({
      message: `Excel file downloaded to: ${downloadPath}`,
      metadata: { filePath: downloadPath }
    });
    
    // Set up environment variables for the ETL process
    process.env.EXCEL_FILE_PATH = downloadPath;
    process.env.ORGANIZATION_NAME = folderName;
    
    // Execute the ETL injection process
    logger.info({ message: 'Starting ETL process...' });
    const result = await runEtl();
    
    logger.info({
      message: 'ETL process completed successfully',
      metadata: { result }
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify('ETL process completed successfully!')
    };
  } catch (error) {
    logger.error({
      message: 'Error processing Excel file',
      metadata: {
        error: {
          message: error.message,
          stack: error.stack
        }
      }
    });
    
    throw error;
  }
};

/**
 * Downloads a file from S3 to the local filesystem
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @param {string} downloadPath - Local path to download the file to
 */
async function downloadFromS3(bucket, key, downloadPath) {
  const params = {
    Bucket: bucket,
    Key: key
  };
  
  const data = await s3.getObject(params).promise();
  fs.writeFileSync(downloadPath, data.Body);
  
  logger.info({
    message: 'File downloaded from S3',
    metadata: { bucket, key, size: data.Body.length }
  });
}
