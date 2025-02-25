const express = require('express');
const tenantOnboardingController = require('../controllers/tenantOnboardingController');

const router = express.Router();

// ETL route
router.post('/process-excel', tenantOnboardingController.processExcelFile);

module.exports = router;
