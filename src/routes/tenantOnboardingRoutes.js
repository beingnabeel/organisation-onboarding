const express = require('express');
const tenantOnboardingController = require('../controllers/tenantOnboardingController');

const router = express.Router();

// ETL route
router.post('/process-excel', tenantOnboardingController.processExcelFile);

// Generic data handler endpoint for all object types
router.post('/:objectType', tenantOnboardingController.handleObjectData);

module.exports = router;
