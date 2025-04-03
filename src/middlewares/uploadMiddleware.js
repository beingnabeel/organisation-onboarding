// src/middlewares/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const AppError = require('../utils/appError');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check both MIME type and file extension
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.xlsx', '.xls'];
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/excel',
    'application/x-excel',
    'application/x-msexcel'
  ];

  if (allowedExtensions.includes(fileExtension) && allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file format. Please upload only Excel files (.xlsx or .xls).', 400), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter,
});

module.exports = upload;