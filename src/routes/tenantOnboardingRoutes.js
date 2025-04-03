const express = require("express");
const tenantOnboardingController = require("../controllers/tenantOnboardingController");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();
// Upload Excel file to S3
router.post(
  "/upload-excel",
  upload.single("excelFile"),
  tenantOnboardingController.uploadExcelToS3
);
// ETL route
router.post("/process-excel", tenantOnboardingController.processExcelFile);

// Generic data handler endpoint for all object types
router.post("/:objectType", tenantOnboardingController.handleObjectData);

// GET endpoints for retrieving entities by ID
router.get("/:objectType/:id", tenantOnboardingController.getObjectById);

module.exports = router;
