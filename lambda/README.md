# Tenant Onboarding ETL Automation with AWS Lambda

This package provides an AWS Lambda function that automatically processes Excel files uploaded to an S3 bucket. The Lambda function triggers the ETL process to extract, transform, and load data into the database through RabbitMQ queues.

## System Architecture

```
Excel Upload (via API) → S3 Bucket → S3 Event → Lambda Function → ETL Process → Database
```

## Features

- **Automatic Triggering**: The ETL process runs automatically when Excel files are uploaded to S3
- **Queue-Based Processing**: Uses RabbitMQ for reliable message processing
- **Specialized Object Handling**: Processes various object types including:
  - Employee data (personal details, bank details, financial details)
  - Salary structures and components
  - Payroll cycles and runs
  - Policy modules and settings
- **Error Handling**: Processes failed data queue first and clears passed data queue when failures exist
- **Retry Logic**: Implements retry mechanisms for handling temporary errors
- **Rollback Support**: Maintains data integrity with rollback capabilities
- **Comprehensive Logging**: Detailed logs for monitoring and debugging

## Prerequisites

1. AWS Account with permissions to create Lambda functions, S3 buckets, and IAM roles
2. RabbitMQ server accessible from AWS Lambda
3. API server accessible from AWS Lambda
4. AWS CLI and SAM CLI installed locally (for deployment)
5. Node.js 18.x or later

## Deployment

### Option 1: Using the Deployment Script

1. Make the deployment script executable:
   ```bash
   chmod +x deploy.sh
   ```

2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

3. Follow the prompts to enter:
   - S3 bucket name for Excel file uploads
   - RabbitMQ URL
   - API base URL

### Option 2: Manual Deployment

1. Prepare your Lambda package:
   ```bash
   # Create a deployment directory
   mkdir -p lambda-deployment
   
   # Copy Lambda code
   cp -r *.js package.json lambda-deployment/
   
   # Copy required service and utility files
   mkdir -p lambda-deployment/utils lambda-deployment/services
   cp -r ../src/utils/logger.js lambda-deployment/utils/
   cp -r ../src/services/mqService.js lambda-deployment/services/
   cp -r ../src/services/consumePassedData.js lambda-deployment/services/
   cp -r ../src/services/etlService.js lambda-deployment/services/
   
   # Install dependencies
   cd lambda-deployment
   npm install --production
   
   # Create deployment package
   zip -r deployment.zip .
   ```

2. Deploy using AWS CloudFormation:
   ```bash
   aws cloudformation deploy \
     --template-file template.yaml \
     --stack-name tenant-onboarding-etl \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       S3BucketName=your-s3-bucket-name \
       RabbitMQURL=amqp://your-rabbitmq-server \
       ApiBaseURL=http://your-api-server:8085
   ```

## Configuration

The Lambda function is configured using environment variables:

- `RABBITMQ_URL`: URL for connecting to the RabbitMQ server
- `API_BASE_URL`: Base URL for the API server
- `RABBITMQ_EXCHANGE`: RabbitMQ exchange name (default: `etl_exchange`)
- `RABBITMQ_PASSED_QUEUE`: Queue for passed data (default: `passed_data`)
- `RABBITMQ_FAILED_QUEUE`: Queue for failed data (default: `failed_data`)
- `LOG_LEVEL`: Logging level (default: `info`)

## Usage

1. Upload Excel files to the S3 bucket using the API:
   - Endpoint: `http://localhost:8085/api/v1/tenant-onboarding/upload-excel`
   - Method: POST
   - Form data: 
     - `organizationName`: Name of the organization (e.g., "kiba")
     - `file`: Excel file attachment

2. The system will:
   - Store the file in S3 under a folder named after the organization
   - The Lambda function will automatically trigger
   - The ETL process will extract, transform, and load data

3. Monitor the process:
   - Check AWS CloudWatch Logs for Lambda execution logs
   - Check your application logs for detailed ETL process logs

## Processing Logic

### Object Types Handled

The ETL process handles various object types with specialized validation and processing:

1. **Employee Data**
   - Employee personal details
   - Employee bank details
   - Employee financial details
   - Employee salaries

2. **Salary Information**
   - Salary structures
   - Salary structure components

3. **Payroll Data**
   - Payroll cycles
   - Payroll runs

4. **Policy Information**
   - Policy modules
   - Policy settings

### Queue Processing Rules

1. If there are messages in the `failed_data` queue:
   - Process all failed messages with detailed logging
   - Clear the `passed_data` queue without processing

2. If there are messages only in the `passed_data` queue:
   - Process all passed messages
   - Ensure the queue is completely empty before closing the connection

## Troubleshooting

### Common Issues

1. **Lambda Function Times Out**:
   - Increase the Lambda timeout in the CloudFormation template
   - Check if RabbitMQ or API server is responding slowly

2. **Connection Issues**:
   - Ensure RabbitMQ and API server are accessible from Lambda
   - For local servers, consider using a service like ngrok to expose them

3. **Permission Issues**:
   - Check IAM role permissions for the Lambda function
   - Ensure S3 bucket permissions allow the Lambda to read files

4. **Data Processing Errors**:
   - Check CloudWatch logs for detailed error messages
   - Look for validation issues in the Excel data

## Architecture Notes

- The Lambda function is designed to handle the complete ETL process
- For production use, consider deploying RabbitMQ and API services to AWS
- VPC configuration may be needed if Lambda needs to access private resources
