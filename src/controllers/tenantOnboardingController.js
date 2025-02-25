const path = require('path');
const { logger } = require('../utils/logger');
const etlService = require('../services/etlService');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * Parse Excel file and write data to etlextract.json
 */
exports.processExcelFile = catchAsync(async (req, res, next) => {
  const filePath = path.resolve(__dirname, '../../kiba_labs_data_sheet_new.xlsx');

  // Start parsing process
  logger.info({
    message: 'Starting Excel parsing process',
    metadata: {
      file: {
        path: filePath
      }
    }
  });

  // Parse Excel file and write to etlextract.json
  const parsedData = await etlService.parseExcelFile(filePath);

  res.status(200).json({
    status: 'success',
    message: 'Excel file parsed and written to etlextract.json successfully',
    data: {
      sheets: Object.keys(parsedData),
      totalSheets: Object.keys(parsedData).length
    }
  });
});
