const etlService = require('../services/etlService');
const { logger } = require('../utils/logger');
const path = require('path');

/**
 * Test script to run the complete ETL process
 * - Parse Excel file to JSON
 * - Transform the data
 * - Save to output file
 */
async function runETLProcess() {
  try {
    // etlService is already an instance
    const excelFilePath = path.resolve(__dirname, '../../kiba_labs_data_sheet_new.xlsx');
    
    // 1. Parse Excel file
    logger.info('Starting Excel file parsing...');
    const extractedData = await etlService.parseExcelFile(excelFilePath);
    logger.info('Excel parsing completed successfully');
    
    // 2. Transform the data
    logger.info('Starting data transformation...');
    const transformedData = await etlService.transformData(extractedData);
    logger.info('Data transformation completed successfully');
    
    // 3. Log summary
    logger.info({
      message: 'ETL process completed successfully',
      metadata: {
        extractedDataSheets: Object.keys(extractedData),
        transformedObjectCount: transformedData.length
      }
    });
    
    return { success: true, transformedData };
  } catch (error) {
    logger.error({
      message: 'ETL process failed',
      metadata: {
        error: {
          message: error.message,
          stack: error.stack
        }
      }
    });
    return { success: false, error: error.message };
  }
}

// Run the ETL process if this script is executed directly
if (require.main === module) {
  logger.info('Starting ETL test script...');
  runETLProcess()
    .then(result => {
      if (result.success) {
        logger.info('ETL test completed successfully');
      } else {
        logger.error(`ETL test failed: ${result.error}`);
      }
    })
    .catch(err => {
      logger.error(`Unexpected error: ${err.message}`);
    });
}

module.exports = { runETLProcess };
