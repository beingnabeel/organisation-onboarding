#!/bin/bash

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${YELLOW}=== Tenant Onboarding ETL Lambda Deployment ===${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}jq is not installed. Please install it first.${NC}"
    exit 1
fi

# Prompt for S3 bucket name
read -p "Enter S3 bucket name for Excel uploads: " S3_BUCKET_NAME

# Prompt for RabbitMQ URL
read -p "Enter RabbitMQ URL [amqp://localhost]: " RABBITMQ_URL
RABBITMQ_URL=${RABBITMQ_URL:-amqp://localhost}

# Prompt for API base URL
read -p "Enter API base URL [http://localhost:8085]: " API_BASE_URL
API_BASE_URL=${API_BASE_URL:-http://localhost:8085}

# Create a new directory for deployment
DEPLOY_DIR="lambda-deploy-$(date +%Y%m%d%H%M%S)"
mkdir -p "$DEPLOY_DIR"

echo -e "${GREEN}Copying files to deployment directory...${NC}"

# Copy Lambda code to deployment directory
cp -r *.js package.json "$DEPLOY_DIR"/
mkdir -p "$DEPLOY_DIR/utils" "$DEPLOY_DIR/services"

# Copy required service and utility files
cp -r ../src/utils/logger.js "$DEPLOY_DIR/utils/"
cp -r ../src/services/mqService.js "$DEPLOY_DIR/services/"
cp -r ../src/services/consumePassedData.js "$DEPLOY_DIR/services/"
cp -r ../src/services/etlService.js "$DEPLOY_DIR/services/"

# Go to deployment directory
cd "$DEPLOY_DIR"

echo -e "${GREEN}Installing dependencies...${NC}"
npm install --production

echo -e "${GREEN}Creating deployment package...${NC}"
zip -r deployment.zip . -x "*.git*"

echo -e "${GREEN}Deploying Lambda function with CloudFormation...${NC}"

# Create CloudFormation template
cat > template.yaml << EOL
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Tenant Onboarding ETL Lambda triggered by S3 uploads

Parameters:
  S3BucketName:
    Type: String
    Default: ${S3_BUCKET_NAME}
    Description: The name of the S3 bucket where Excel files are uploaded
  
  RabbitMQURL:
    Type: String
    Default: ${RABBITMQ_URL}
    Description: The URL for connecting to RabbitMQ server
  
  ApiBaseUrl:
    Type: String
    Default: ${API_BASE_URL}
    Description: The base URL for the API server

Resources:
  TenantOnboardingETLFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: tenant-onboarding-etl-processor
      CodeUri: ./deployment.zip
      Handler: index.handler
      Runtime: nodejs18.x
      Architectures:
        - x86_64
      MemorySize: 512
      Timeout: 900 # 15 minutes
      Environment:
        Variables:
          RABBITMQ_URL: !Ref RabbitMQURL
          API_BASE_URL: !Ref ApiBaseUrl
          RABBITMQ_EXCHANGE: etl_exchange
          RABBITMQ_PASSED_QUEUE: passed_data
          RABBITMQ_FAILED_QUEUE: failed_data
          LOG_LEVEL: info
      Policies:
        - S3ReadPolicy:
            BucketName: !Ref S3BucketName
      Events:
        S3Event:
          Type: S3
          Properties:
            Bucket: !Ref TenantOnboardingBucket
            Events: s3:ObjectCreated:*
            Filter:
              S3Key:
                Rules:
                  - Suffix: .xlsx

  TenantOnboardingBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Ref S3BucketName
      NotificationConfiguration:
        LambdaConfigurations:
          - Event: s3:ObjectCreated:*
            Filter:
              S3Key:
                Rules:
                  - Suffix: .xlsx
            Function: !GetAtt TenantOnboardingETLFunction.Arn

  BucketPermission:
    Type: AWS::Lambda::Permission
    Properties:
      Action: lambda:InvokeFunction
      FunctionName: !Ref TenantOnboardingETLFunction
      Principal: s3.amazonaws.com
      SourceArn: !Sub arn:aws:s3:::${S3BucketName}

Outputs:
  TenantOnboardingETLFunction:
    Description: "Tenant Onboarding ETL Lambda Function ARN"
    Value: !GetAtt TenantOnboardingETLFunction.Arn

  TenantOnboardingBucket:
    Description: "S3 bucket for uploading Excel files"
    Value: !Ref TenantOnboardingBucket
EOL

# Deploy using SAM CLI if available, otherwise use CloudFormation directly
if command -v sam &> /dev/null; then
    echo -e "${GREEN}Deploying with AWS SAM...${NC}"
    sam deploy --template-file template.yaml --stack-name tenant-onboarding-etl --capabilities CAPABILITY_IAM --parameter-overrides S3BucketName=${S3_BUCKET_NAME} RabbitMQURL=${RABBITMQ_URL} ApiBaseUrl=${API_BASE_URL}
else
    echo -e "${YELLOW}AWS SAM CLI not found. Using CloudFormation directly...${NC}"
    aws cloudformation package --template-file template.yaml --s3-bucket ${S3_BUCKET_NAME} --output-template-file packaged.yaml
    aws cloudformation deploy --template-file packaged.yaml --stack-name tenant-onboarding-etl --capabilities CAPABILITY_IAM --parameter-overrides S3BucketName=${S3_BUCKET_NAME} RabbitMQURL=${RABBITMQ_URL} ApiBaseUrl=${API_BASE_URL}
fi

echo -e "${GREEN}Deployment completed!${NC}"
echo -e "${YELLOW}Note: If your RabbitMQ or API services are running locally, you'll need to expose them to the internet for Lambda to access them.${NC}"
echo -e "${YELLOW}For production use, consider deploying your RabbitMQ and API services to AWS as well.${NC}"

# Go back to original directory
cd ..

echo -e "${GREEN}Done!${NC}"
