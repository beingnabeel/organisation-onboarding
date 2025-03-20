const express = require('express');
const tenantOnboardingController = require('../controllers/tenantOnboardingController');

const router = express.Router();

// ETL route
router.post('/process-excel', tenantOnboardingController.processExcelFile);

// Generic data handler endpoint for all object types
router.post('/:objectType', tenantOnboardingController.handleObjectData);

// GET endpoints for retrieving entities by ID
router.get('/:objectType/:id', tenantOnboardingController.getObjectById);

module.exports = router;
