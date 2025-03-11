const path = require("path");
const { logger } = require("../utils/logger");
const etlService = require("../services/etlService");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Parse Excel file and write data to etlextract.json
 */
exports.processExcelFile = catchAsync(async (req, res, next) => {
  const filePath = path.resolve(
    __dirname,
    "../../kiba_labs_data_sheet_new.xlsx"
  );

  // Start parsing process
  logger.info({
    message: "Starting Excel parsing process",
    metadata: {
      file: {
        path: filePath,
      },
    },
  });

  // Parse Excel file and write to etlextract.json
  const parsedData = await etlService.parseExcelFile(filePath);

  res.status(200).json({
    status: "success",
    message: "Excel file parsed and written to etlextract.json successfully",
    data: {
      sheets: Object.keys(parsedData),
      totalSheets: Object.keys(parsedData).length,
    },
  });
});

/**
 * Handle objects of different types received from RabbitMQ consumer
 * Maps object types to Prisma models and inserts the data
 */
exports.handleObjectData = catchAsync(async (req, res, next) => {
  const { objectType } = req.params;
  const data = req.body;

  if (!data) {
    return next(new AppError("No data provided", 400));
  }

  logger.info({
    message: `Processing ${objectType} data`,
    metadata: {
      objectType,
      timestamp: new Date().toISOString(),
    },
  });

  // Map object types (from URL) to Prisma model names
  const modelMap = {
    organizations: "organization",
    banks: "bankMaster",
    "organization-bank-details": "organizationBankDetail",
    "organization-tax-details": "organizationTaxDetail",
    "organization-compliance-details": "organizationComplianceDetail",
    countries: "countryMaster",
    states: "stateMaster",
    "organization-locations": "organizationLocation",
    "department-types": "departmentType",
    departments: "department",
    "employment-types": "employmentType",
    "job-titles": "jobTitle",
    employees: "employee",
    "employee-personal-details": "employeePersonalDetail",
    "employee-bank-details": "employeeBankDetail",
    "employee-financial-details": "employeeFinancialDetail",
    "salary-components": "salaryComponentMaster",
    "salary-structures": "salaryStructure",
    "salary-structure-components": "salaryStructureComponent",
    "employee-salaries": "employeeSalary",
    "payroll-cycles": "payrollCycle",
    "payroll-runs": "payrollRun",
    "policy-modules": "policyModule",
    "policy-settings": "policySetting",
    "probation-policies": "probationPolicy",
    "policy-document-versions": "policyDocumentVersion",
    "policy-acknowledgments": "policyAcknowledgment",
    "leave-policy-configurations": "leavePolicyConfiguration",
    "holiday-calendar-years": "holidayCalendarYear",
    "holiday-masters": "holidayMaster",
    "holiday-calendar-details": "holidayCalendarDetail",
    "attendance-settings": "attendanceSettings",
    "shift-configurations": "shiftConfiguration",
    "employee-shift-assignments": "employeeShiftAssignment",
  };

  // Map object types to their primary key field names
  const primaryKeyMap = {
    organizations: "org_id",
    banks: "bank_id",
    "organization-bank-details": "org_bank_id",
    "organization-tax-details": "org_tax_id",
    "organization-compliance-details": "org_compliance_id",
    countries: "country_id",
    states: "state_id",
    "organization-locations": "location_id",
    "department-types": "dept_type_id",
    departments: "department_id",
    "employment-types": "employment_type_id",
    "job-titles": "job_title_id",
    employees: "employee_id",
    "employee-personal-details": "employee_personal_id",
    "employee-bank-details": "employee_bank_id",
    "employee-financial-details": "financial_detail_id",
    "salary-components": "component_id",
    "salary-structures": "structure_id",
    "salary-structure-components": "structure_component_id",
    "employee-salaries": "employee_salary_id",
    "payroll-cycles": "cycle_id",
    "payroll-runs": "run_id",
    "policy-modules": "module_id",
    "policy-settings": "setting_id",
    "probation-policies": "policy_id",
    "policy-document-versions": "version_id",
    "policy-acknowledgments": "acknowledgment_id",
    "leave-policy-configurations": "leave_policy_id",
    "holiday-calendar-years": "calendar_year_id",
    "holiday-masters": "holiday_id",
    "holiday-calendar-details": "holiday_detail_id",
    "attendance-settings": "setting_id",
    "shift-configurations": "shift_id",
    "employee-shift-assignments": "assignment_id",
  };

  const modelName = modelMap[objectType];
  const primaryKeyField = primaryKeyMap[objectType];

  if (!modelName) {
    return next(new AppError(`Unsupported object type: ${objectType}`, 400));
  }

  if (!primaryKeyField) {
    return next(
      new AppError(
        `Primary key not defined for object type: ${objectType}`,
        400
      )
    );
  }

  try {
    // Check if the model exists in Prisma
    if (!prisma[modelName]) {
      return next(
        new AppError(`Model not found for object type: ${objectType}`, 400)
      );
    }

    // Create where condition using the correct primary key field
    const whereCondition = {};
    whereCondition[primaryKeyField] = data[primaryKeyField];

    // Use Prisma to insert/update the data
    const result = await prisma[modelName].upsert({
      where: whereCondition,
      update: data,
      create: data,
    });

    logger.info({
      message: `Successfully processed ${objectType} data`,
      metadata: {
        objectType,
        resultId: result.id,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(201).json({
      status: "success",
      message: `${objectType} data processed successfully`,
      data: { result },
    });
  } catch (error) {
    logger.error({
      message: `Failed to process ${objectType} data`,
      metadata: {
        error: {
          message: error.message,
          stack: error.stack,
        },
        timestamp: new Date().toISOString(),
      },
    });

    return next(
      new AppError(
        `Failed to process ${objectType} data: ${error.message}`,
        500
      )
    );
  }
});
