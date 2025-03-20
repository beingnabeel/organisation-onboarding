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
    "organization-locations": "OrganizationLocation",
    "department-types": "departmentType",
    departments: "department",
    "employment-types": "employmentType",
    "job-titles": "jobTitle",
    employees: "employee",
  employee: "employee", // Added singular form to handle both formats
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
    departments: "dept_id",
    "employment-types": "employment_type_id",
    "job-titles": "job_title_id",
    employees: "employee_id",
  employee: "employee_id", // Added singular form to handle both formats
    "employee-personal-details": "empl_personal_det_id",
    "employee-bank-details": "employee_bank_id",
    "employee-financial-details": "empl_financial_id",
    "salary-components": "component_id",
    "salary-structures": "structure_id",
    "salary-structure-components": "structure_component_id",
    "employee-salaries": "salary_id",
    "payroll-cycles": "cycle_id",
    "payroll-runs": "run_id",
    "policy-modules": "module_id",
    "policy-settings": "setting_id",
    "probation-policies": "policy_id",
    "policy-document-versions": "version_id",
    "policy-acknowledgments": "acknowledgment_id",
    "leave-policy-configurations": "config_id", // Fixed: was using leave_policy_id which is wrong
    "holiday-calendar-years": "calendar_id",
    "holiday-masters": "holiday_id",
    "holiday-calendar-details": "holiday_detail_id",
    "attendance-settings": "id",
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
    let whereCondition = {};

    // Special handling for HolidayCalendarYear model
    if (objectType === "holiday-calendar-years") {
      // If calendar_id is missing but we have org_id and year which form a unique constraint
      if (!data.calendar_id && data.org_id && data.year !== undefined) {
        // Using the unique constraint instead of the primary key
        logger.info({
          message: `Using unique_org_year constraint for HolidayCalendarYear upsert`,
          metadata: {
            org_id: data.org_id,
            year: data.year,
            timestamp: new Date().toISOString(),
          },
        });

        whereCondition = {
          unique_org_year: {
            org_id: data.org_id,
            year: data.year,
          },
        };
      } else if (data.calendar_id) {
        whereCondition = { calendar_id: data.calendar_id };
      } else {
        logger.error({
          message: `Cannot upsert HolidayCalendarYear: missing required unique identifier`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        throw new Error(
          "HolidayCalendarYear requires either calendar_id or both org_id and year"
        );
      }
    }
    // Special handling for AttendanceSettings model
    else if (objectType === "attendance-settings") {
      // Check for required identifiers
      if (data.id) {
        // Use primary key if available
        whereCondition = { id: data.id };
        logger.info({
          message: `Using id for AttendanceSettings upsert`,
          metadata: {
            id: data.id,
            timestamp: new Date().toISOString(),
          },
        });
      } else if (data.organizationId) {
        // For models with unique constraints in Prisma, we need to use a different approach
        // since we're having issues with the unique_org_attendance_settings constraint
        logger.info({
          message: `Using findFirst + upsert for AttendanceSettings with organizationId`,
          metadata: {
            organizationId: data.organizationId,
            timestamp: new Date().toISOString(),
          },
        });

        // First, we'll query for the record using where filter directly
        try {
          const existingSettings = await prisma.AttendanceSettings.findFirst({
            where: { organizationId: data.organizationId },
          });

          let result;
          if (existingSettings) {
            // If we found an existing record, use its ID for the upsert
            whereCondition = { id: existingSettings.id };
            logger.info({
              message: `Found existing AttendanceSettings with id ${existingSettings.id}`,
              metadata: {
                organizationId: data.organizationId,
                id: existingSettings.id,
                timestamp: new Date().toISOString(),
              },
            });
          } else {
            // For testing purposes, let's find an existing PolicyModule to use
            try {
              // First try to find any policy module in the system to use for testing
              // Use snake_case naming convention for database fields
              const anyPolicyModule = await prisma.PolicyModule.findFirst({
                where: {}, // Get any policy module
                orderBy: { created_at: "desc" }, // Use snake_case for field names in the database
              });

              if (anyPolicyModule) {
                // Update the moduleId to use the existing module
                data.moduleId = anyPolicyModule.id;

                logger.info({
                  message: `Using existing PolicyModule for AttendanceSettings`,
                  metadata: {
                    originalModuleId: data.moduleId,
                    updatedModuleId: anyPolicyModule.id,
                    organizationId: data.organizationId,
                    timestamp: new Date().toISOString(),
                  },
                });
              } else {
                // Debug to see what modules actually exist
                logger.warn({
                  message: `No PolicyModules found in the database. Cannot create AttendanceSettings.`,
                  metadata: {
                    organizationId: data.organizationId,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Create a temporary PolicyModule for testing
                try {
                  // Check other required fields based on error messages
                  const tempModule = await prisma.PolicyModule.create({
                    data: {
                      // Use snake_case field names to match database schema
                      module_name: "Temporary Attendance Policy",
                      module_code: "TEMP-ATT-001",
                      module_description:
                        "Created for testing AttendanceSettings",
                      org_id: data.organizationId,
                      module_category: "attendance",
                      version: "1.0",
                      is_mandatory: true,
                      status: "active",
                      effective_from: new Date().toISOString(),
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                  });

                  // Use the newly created module
                  data.moduleId = tempModule.id;

                  logger.info({
                    message: `Created temporary PolicyModule for testing`,
                    metadata: {
                      moduleId: tempModule.id,
                      organizationId: data.organizationId,
                      timestamp: new Date().toISOString(),
                    },
                  });
                } catch (createError) {
                  logger.error({
                    message: `Failed to create temporary PolicyModule`,
                    metadata: {
                      error: createError.message,
                      organizationId: data.organizationId,
                      timestamp: new Date().toISOString(),
                    },
                  });

                  // If we can't create a module, we can't proceed
                  throw new Error(
                    `Cannot create AttendanceSettings: No valid PolicyModule available`
                  );
                }
              }

              // Now create the AttendanceSettings with the updated moduleId
              result = await prisma.AttendanceSettings.create({
                data: data,
              });
            } catch (error) {
              logger.error({
                message: `Failed to handle PolicyModule dependency for AttendanceSettings`,
                metadata: {
                  error: {
                    message: error.message,
                    stack: error.stack,
                  },
                  organizationId: data.organizationId,
                  timestamp: new Date().toISOString(),
                },
              });
              throw error;
            }

            logger.info({
              message: `Created new AttendanceSettings for organization`,
              metadata: {
                organizationId: data.organizationId,
                id: result.id,
                timestamp: new Date().toISOString(),
              },
            });

            // Return the result directly to bypass the default upsert logic
            return res.status(201).json({
              status: "success",
              message: `${objectType} data processed successfully`,
              data: { result },
            });
          }
        } catch (error) {
          logger.error({
            message: `Failed to process AttendanceSettings lookup`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              timestamp: new Date().toISOString(),
            },
          });
          throw error;
        }
      } else {
        logger.error({
          message: `Cannot process AttendanceSettings: missing required unique identifier`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        throw new Error(
          "AttendanceSettings requires either id or organizationId"
        );
      }
    }
    // Special handling for LeavePolicyConfiguration model to use its unique constraint
    else if (
      objectType === "leave-policy-configurations" &&
      req.query.useUniqueLeaveTypeOrg === "true"
    ) {
      // Using the unique constraint instead of the primary key
      logger.info({
        message: `Using unique_leave_type_org constraint for LeavePolicyConfiguration upsert`,
        metadata: {
          org_id: data.org_id,
          leave_type: data.leave_type,
          timestamp: new Date().toISOString(),
        },
      });

      whereCondition = {
        unique_leave_type_org: {
          org_id: data.org_id,
          leave_type: data.leave_type,
        },
      };
    }
    // Special handling for DepartmentType model to use type_code as a unique constraint
    else if (objectType === "department-types") {
      // Clean up data by removing fields that don't belong to DepartmentType model
      if (data.employment_type_id) {
        logger.warn({
          message: `Invalid field 'employment_type_id' found in DepartmentType data, removing it`,
          metadata: {
            employment_type_id: data.employment_type_id,
            timestamp: new Date().toISOString(),
          },
        });
        delete data.employment_type_id;
      }

      // Check if dept_type_id exists, if not use type_code which is unique
      if (!data.dept_type_id && data.type_code) {
        logger.info({
          message: `Using type_code as unique constraint for DepartmentType upsert`,
          metadata: {
            type_code: data.type_code,
            timestamp: new Date().toISOString(),
          },
        });

        whereCondition = { type_code: data.type_code };
      }
      // If type_code is not available but type_name is, use type_name
      else if (!data.dept_type_id && !data.type_code && data.type_name) {
        logger.info({
          message: `Using type_name as unique constraint for DepartmentType upsert`,
          metadata: {
            type_name: data.type_name,
            timestamp: new Date().toISOString(),
          },
        });

        whereCondition = { type_name: data.type_name };
      } else {
        // Standard case - use primary key
        if (!data[primaryKeyField]) {
          logger.warn({
            message: `Primary key value missing for ${objectType}`,
            metadata: {
              primaryKeyField,
              data: JSON.stringify(data),
              timestamp: new Date().toISOString(),
            },
          });
        }
        whereCondition[primaryKeyField] = data[primaryKeyField];
      }
    }
    // Special handling for EmploymentType model to fix possible data mismatches
    else if (objectType === "employment-types") {
      // Check if employment_type_id exists, if not use type_code which is unique
      if (!data.employment_type_id && data.type_code) {
        logger.info({
          message: `Using type_code as unique constraint for EmploymentType upsert`,
          metadata: {
            type_code: data.type_code,
            timestamp: new Date().toISOString(),
          },
        });

        whereCondition = { type_code: data.type_code };
      } else {
        // Standard case - use primary key
        if (!data[primaryKeyField]) {
          logger.warn({
            message: `Primary key value missing for ${objectType}`,
            metadata: {
              primaryKeyField,
              data: JSON.stringify(data),
              timestamp: new Date().toISOString(),
            },
          });
        }
        whereCondition[primaryKeyField] = data[primaryKeyField];
      }
    }
    // Special handling for Department model to use dept_code as a unique constraint
    else if (objectType === "departments") {
      // Clean up data by checking for department_id and converting it to dept_id if needed
      if (data.department_id && !data.dept_id) {
        logger.info({
          message: `Found department_id instead of dept_id, copying value`,
          metadata: {
            department_id: data.department_id,
            timestamp: new Date().toISOString(),
          },
        });
        data.dept_id = data.department_id;
        delete data.department_id;
      }

      // Check and handle parent_dept_id references to avoid foreign key constraint violations
      if (data.parent_dept_id) {
        logger.info({
          message: `Checking parent department reference`,
          metadata: {
            dept_id: data.dept_id,
            parent_dept_id: data.parent_dept_id,
            timestamp: new Date().toISOString(),
          },
        });

        try {
          // Use the correct Prisma model name (lowercase)
          const parentDepartment = await prisma.Department.findUnique({
            where: { dept_id: data.parent_dept_id },
          });

          // If parent department doesn't exist, set to null to avoid foreign key constraint errors
          if (!parentDepartment) {
            logger.warn({
              message: `Parent department with ID ${data.parent_dept_id} not found, setting parent_dept_id to null`,
              metadata: {
                dept_id: data.dept_id,
                parent_dept_id: data.parent_dept_id,
                timestamp: new Date().toISOString(),
              },
            });
            // Make sure to set to null to avoid foreign key constraint errors
            data.parent_dept_id = null;
          } else {
            logger.info({
              message: `Parent department exists, keeping reference`,
              metadata: {
                parent_dept_id: data.parent_dept_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        } catch (error) {
          logger.warn({
            message: `Error checking parent department, setting parent_dept_id to null`,
            metadata: {
              error: error.message,
              timestamp: new Date().toISOString(),
            },
          });
          data.parent_dept_id = null;
        }
      }

      // Check if dept_id exists, if not use dept_code which is unique
      if (!data.dept_id && data.dept_code) {
        logger.info({
          message: `Using dept_code as unique constraint for Department upsert`,
          metadata: {
            dept_code: data.dept_code,
            timestamp: new Date().toISOString(),
          },
        });

        whereCondition = { dept_code: data.dept_code };
      } else {
        // Standard case - use primary key
        if (!data[primaryKeyField]) {
          logger.warn({
            message: `Primary key value missing for ${objectType}`,
            metadata: {
              primaryKeyField,
              data: JSON.stringify(data),
              timestamp: new Date().toISOString(),
            },
          });
        }
        whereCondition[primaryKeyField] = data[primaryKeyField];
      }
    }
    // Special handling for ShiftConfiguration model
    else if (objectType === "shift-configurations") {
      // First set up the whereCondition properly for the upsert operation
      if (data.shift_id) {
        // Use primary key if available
        whereCondition = { shift_id: data.shift_id };
        logger.info({
          message: `Using primary key for ShiftConfiguration upsert`,
          metadata: {
            shift_id: data.shift_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else if (data.org_id && data.shift_name) {
        // Use the unique constraint for org_id and shift_name
        whereCondition = {
          unique_shift_name_org: {
            org_id: data.org_id,
            shift_name: data.shift_name,
          },
        };
        logger.info({
          message: `Using unique_shift_name_org constraint for ShiftConfiguration upsert`,
          metadata: {
            org_id: data.org_id,
            shift_name: data.shift_name,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot process ShiftConfiguration: missing required unique identifier`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier for ShiftConfiguration: need either shift_id or both org_id and shift_name",
          data: null,
        });
      }

      // First, check if the organization exists
      if (data.org_id) {
        try {
          const organizationExists = await prisma.Organization.findUnique({
            where: { org_id: data.org_id },
          });

          if (!organizationExists) {
            logger.error({
              message: `Cannot process ShiftConfiguration: Organization with ID ${data.org_id} does not exist`,
              metadata: {
                data: JSON.stringify(data),
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Organization with ID ${data.org_id} does not exist`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking organization existence`,
            metadata: {
              error: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking organization existence: ${error.message}`,
            data: null,
          });
        }
      }

      // Handle foreign key constraint for created_by field
      if (data.created_by) {
        logger.info({
          message: `Checking employee reference for ShiftConfiguration created_by`,
          metadata: {
            shift_id: data.shift_id,
            created_by: data.created_by,
            timestamp: new Date().toISOString(),
          },
        });

        try {
          // Check if the referenced employee exists
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.created_by },
          });

          // If employee doesn't exist, set to null to avoid foreign key constraint errors
          if (!employee) {
            logger.warn({
              message: `Employee with ID ${data.created_by} not found for created_by, setting to null`,
              metadata: {
                shift_id: data.shift_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Set to null to avoid foreign key constraint errors
            data.created_by = null;
            // Also set updated_by to null if it's the same
            if (data.updated_by === data.created_by) {
              data.updated_by = null;
            }
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee reference for ShiftConfiguration created_by`,
            metadata: {
              error: error.message,
              stack: error.stack,
              shift_id: data.shift_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Set to null in case of error
          data.created_by = null;
        }
      }

      // Handle updated_by if present
      if (data.updated_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.updated_by },
          });

          if (!employee) {
            logger.warn({
              message: `Employee with ID ${data.updated_by} not found for updated_by, setting to null`,
              metadata: {
                shift_id: data.shift_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.updated_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee reference for ShiftConfiguration updated_by`,
            metadata: {
              error: error.message,
              shift_id: data.shift_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.updated_by = null;
        }
      }
    }
    // Special handling for Employee model
    else if (objectType === "employees") {
      // First set up the whereCondition properly for the upsert operation
      if (data.employee_id) {
        // Use primary key if available
        whereCondition = { employee_id: data.employee_id };
        logger.info({
          message: `Using primary key for Employee upsert`,
          metadata: {
            employee_id: data.employee_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else if (data.employee_number && data.org_id) {
        // Use the employee_number which should be unique within an organization
        whereCondition = { employee_number: data.employee_number };
        logger.info({
          message: `Using employee_number for Employee upsert`,
          metadata: {
            employee_number: data.employee_number,
            org_id: data.org_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for Employee`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier for Employee: need either employee_id or both employee_number and org_id",
          data: null,
        });
      }

      // Verify that org_id exists
      if (data.org_id) {
        try {
          const organization = await prisma.Organization.findUnique({
            where: { org_id: data.org_id },
          });

          if (!organization) {
            logger.error({
              message: `Organization with ID ${data.org_id} not found for Employee`,
              metadata: {
                employee_id: data.employee_id,
                org_id: data.org_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid org_id: Organization not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking organization reference for Employee`,
            metadata: {
              error: error.message,
              stack: error.stack,
              employee_id: data.employee_id,
              org_id: data.org_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking organization reference: ${error.message}`,
            data: null,
          });
        }
      }

      // Check and handle work_location_id - this is a critical foreign key reference
      if (data.work_location_id) {
        try {
          const location = await prisma.OrganizationLocation.findUnique({
            where: { location_id: data.work_location_id },
          });

          if (!location) {
            logger.warn({
              message: `Location with ID ${data.work_location_id} not found for Employee, attempting to locate by org_id and location name if available`,
              metadata: {
                employee_id: data.employee_id,
                work_location_id: data.work_location_id,
                timestamp: new Date().toISOString(),
              },
            });
            
            // If we have org_id and work_location_name, try to find or create the location
            if (data.org_id && data.work_location_name) {
              // Try to find by name within the organization
              const locationByName = await prisma.OrganizationLocation.findFirst({
                where: { 
                  org_id: data.org_id,
                  location_name: data.work_location_name 
                },
              });
              
              if (locationByName) {
                // Use the found location
                data.work_location_id = locationByName.location_id;
                logger.info({
                  message: `Found existing location by name for Employee`,
                  metadata: {
                    employee_id: data.employee_id,
                    work_location_id: locationByName.location_id,
                    work_location_name: data.work_location_name,
                    timestamp: new Date().toISOString(),
                  },
                });
              } else {
                // Create a new location
                try {
                  const newLocation = await prisma.OrganizationLocation.create({
                    data: {
                      org_id: data.org_id,
                      location_name: data.work_location_name,
                      status: 'active',
                      created_at: new Date(),
                      updated_at: new Date()
                    },
                  });
                  
                  data.work_location_id = newLocation.location_id;
                  logger.info({
                    message: `Created new location for Employee`,
                    metadata: {
                      employee_id: data.employee_id,
                      work_location_id: newLocation.location_id,
                      work_location_name: data.work_location_name,
                      timestamp: new Date().toISOString(),
                    },
                  });
                } catch (createError) {
                  logger.error({
                    message: `Failed to create new location for Employee`,
                    metadata: {
                      error: createError.message,
                      stack: createError.stack,
                      employee_id: data.employee_id,
                      org_id: data.org_id,
                      work_location_name: data.work_location_name,
                      timestamp: new Date().toISOString(),
                    },
                  });
                  // Set to null as fallback
                  data.work_location_id = null;
                }
              }
            } else {
              // Set to null if we can't find or create a location
              data.work_location_id = null;
              logger.warn({
                message: `Setting work_location_id to null for Employee - missing required information to create location`,
                metadata: {
                  employee_id: data.employee_id,
                  timestamp: new Date().toISOString(),
                },
              });
            }
          }
        } catch (error) {
          logger.error({
            message: `Error checking location reference for Employee`,
            metadata: {
              error: error.message,
              stack: error.stack,
              employee_id: data.employee_id,
              work_location_id: data.work_location_id,
              timestamp: new Date().toISOString(),
            },
          });
          // Set to null in case of error
          data.work_location_id = null;
        }
      }

      // Map department_id to dept_id if needed
      if (data.department_id && !data.dept_id) {
        data.dept_id = data.department_id;
        delete data.department_id;
      }

      // Check dept_id if present and attempt to create if missing
      if (data.dept_id) {
        try {
          const department = await prisma.Department.findUnique({
            where: { dept_id: data.dept_id },
          });

          if (!department) {
            logger.warn({
              message: `Department with ID ${data.dept_id} not found for Employee, attempting to create it if we have dept_name and org_id`,
              metadata: {
                employee_id: data.employee_id,
                dept_id: data.dept_id,
                timestamp: new Date().toISOString(),
              },
            });
            
            // If we have org_id and dept_name, try to find or create the department
            if (data.org_id && data.dept_name) {
              try {
                // Check if a department with the same name exists in the organization
                const deptByName = await prisma.Department.findFirst({
                  where: {
                    org_id: data.org_id,
                    dept_name: data.dept_name,
                  },
                });
                
                if (deptByName) {
                  // Use existing department
                  data.dept_id = deptByName.dept_id;
                  logger.info({
                    message: `Found existing department by name for Employee`,
                    metadata: {
                      employee_id: data.employee_id,
                      dept_id: deptByName.dept_id,
                      dept_name: data.dept_name,
                      timestamp: new Date().toISOString(),
                    },
                  });
                } else {
                  // Try to find a default department type or create one
                  let deptTypeId;
                  try {
                    const deptType = await prisma.DepartmentType.findFirst({
                      where: { org_id: data.org_id },
                    });
                    
                    if (deptType) {
                      deptTypeId = deptType.dept_type_id;
                    } else {
                      // Create a default department type
                      const newDeptType = await prisma.DepartmentType.create({
                        data: {
                          org_id: data.org_id,
                          dept_type_name: 'Default',
                          dept_type_desc: 'Default department type',
                          status: 'active',
                          created_at: new Date(),
                          updated_at: new Date()
                        },
                      });
                      deptTypeId = newDeptType.dept_type_id;
                    }
                    
                    // Create the department
                    const newDept = await prisma.Department.create({
                      data: {
                        org_id: data.org_id,
                        dept_type_id: deptTypeId,
                        dept_name: data.dept_name,
                        dept_desc: data.dept_desc || `${data.dept_name} department`,
                        status: 'active',
                        created_at: new Date(),
                        updated_at: new Date()
                      },
                    });
                    
                    data.dept_id = newDept.dept_id;
                    logger.info({
                      message: `Created new department for Employee`,
                      metadata: {
                        employee_id: data.employee_id,
                        dept_id: newDept.dept_id,
                        dept_name: data.dept_name,
                        timestamp: new Date().toISOString(),
                      },
                    });
                  } catch (deptTypeError) {
                    logger.error({
                      message: `Failed to find or create department type for Employee`,
                      metadata: {
                        error: deptTypeError.message,
                        stack: deptTypeError.stack,
                        employee_id: data.employee_id,
                        org_id: data.org_id,
                        timestamp: new Date().toISOString(),
                      },
                    });
                    // Set dept_id to null as fallback
                    data.dept_id = null;
                  }
                }
              } catch (deptError) {
                logger.error({
                  message: `Failed to find or create department for Employee`,
                  metadata: {
                    error: deptError.message,
                    stack: deptError.stack,
                    employee_id: data.employee_id,
                    org_id: data.org_id,
                    dept_name: data.dept_name,
                    timestamp: new Date().toISOString(),
                  },
                });
                // Set to null as fallback
                data.dept_id = null;
              }
            } else {
              // Set to null if we don't have enough info to create
              data.dept_id = null;
              logger.warn({
                message: `Setting dept_id to null for Employee - missing required information to create department`,
                metadata: {
                  employee_id: data.employee_id,
                  timestamp: new Date().toISOString(),
                },
              });
            }
          }
        } catch (error) {
          logger.error({
            message: `Error checking department reference for Employee`,
            metadata: {
              error: error.message,
              stack: error.stack,
              employee_id: data.employee_id,
              dept_id: data.dept_id,
              timestamp: new Date().toISOString(),
            },
          });
          // Set to null in case of error
          data.dept_id = null;
        }
      }

      // Check job_title_id if present and attempt to create if missing
      if (data.job_title_id) {
        try {
          const jobTitle = await prisma.JobTitle.findUnique({
            where: { job_title_id: data.job_title_id },
          });

          if (!jobTitle) {
            logger.warn({
              message: `JobTitle with ID ${data.job_title_id} not found for Employee, attempting to create it if we have job_title_name and org_id`,
              metadata: {
                employee_id: data.employee_id,
                job_title_id: data.job_title_id,
                timestamp: new Date().toISOString(),
              },
            });
            
            // If we have org_id and job_title_name, try to find or create the job title
            if (data.org_id && data.job_title_name) {
              try {
                // Check if a job title with the same name exists in the organization
                const titleByName = await prisma.JobTitle.findFirst({
                  where: {
                    org_id: data.org_id,
                    job_title_name: data.job_title_name,
                  },
                });
                
                if (titleByName) {
                  // Use existing job title
                  data.job_title_id = titleByName.job_title_id;
                  logger.info({
                    message: `Found existing job title by name for Employee`,
                    metadata: {
                      employee_id: data.employee_id,
                      job_title_id: titleByName.job_title_id,
                      job_title_name: data.job_title_name,
                      timestamp: new Date().toISOString(),
                    },
                  });
                } else {
                  // Create a new job title
                  const newJobTitle = await prisma.JobTitle.create({
                    data: {
                      org_id: data.org_id,
                      job_title_name: data.job_title_name,
                      job_title_desc: data.job_title_desc || `${data.job_title_name} position`,
                      status: 'active',
                      created_at: new Date(),
                      updated_at: new Date()
                    },
                  });
                  
                  data.job_title_id = newJobTitle.job_title_id;
                  logger.info({
                    message: `Created new job title for Employee`,
                    metadata: {
                      employee_id: data.employee_id,
                      job_title_id: newJobTitle.job_title_id,
                      job_title_name: data.job_title_name,
                      timestamp: new Date().toISOString(),
                    },
                  });
                }
              } catch (titleError) {
                logger.error({
                  message: `Failed to find or create job title for Employee`,
                  metadata: {
                    error: titleError.message,
                    stack: titleError.stack,
                    employee_id: data.employee_id,
                    org_id: data.org_id,
                    job_title_name: data.job_title_name,
                    timestamp: new Date().toISOString(),
                  },
                });
                // Set to null as fallback
                data.job_title_id = null;
              }
            } else {
              // Set to null if we don't have enough info to create
              data.job_title_id = null;
              logger.warn({
                message: `Setting job_title_id to null for Employee - missing required information to create job title`,
                metadata: {
                  employee_id: data.employee_id,
                  timestamp: new Date().toISOString(),
                },
              });
            }
          }
        } catch (error) {
          logger.error({
            message: `Error checking job title reference for Employee`,
            metadata: {
              error: error.message,
              stack: error.stack,
              employee_id: data.employee_id,
              job_title_id: data.job_title_id,
              timestamp: new Date().toISOString(),
            },
          });
          // Set to null in case of error
          data.job_title_id = null;
        }
      }

      // Check employment_type_id if present and attempt to create if missing
      if (data.employment_type_id) {
        try {
          const employmentType = await prisma.EmploymentType.findUnique({
            where: { employment_type_id: data.employment_type_id },
          });

          if (!employmentType) {
            logger.warn({
              message: `EmploymentType with ID ${data.employment_type_id} not found for Employee, attempting to create it if we have employment_type_name and org_id`,
              metadata: {
                employee_id: data.employee_id,
                employment_type_id: data.employment_type_id,
                timestamp: new Date().toISOString(),
              },
            });
            
            // If we have org_id and employment_type_name, try to find or create the employment type
            if (data.org_id && data.employment_type_name) {
              try {
                // Check if an employment type with the same name exists in the organization
                const typeByName = await prisma.EmploymentType.findFirst({
                  where: {
                    org_id: data.org_id,
                    employment_type_name: data.employment_type_name,
                  },
                });
                
                if (typeByName) {
                  // Use existing employment type
                  data.employment_type_id = typeByName.employment_type_id;
                  logger.info({
                    message: `Found existing employment type by name for Employee`,
                    metadata: {
                      employee_id: data.employee_id,
                      employment_type_id: typeByName.employment_type_id,
                      employment_type_name: data.employment_type_name,
                      timestamp: new Date().toISOString(),
                    },
                  });
                } else {
                  // Create a new employment type
                  const newEmploymentType = await prisma.EmploymentType.create({
                    data: {
                      org_id: data.org_id,
                      employment_type_name: data.employment_type_name,
                      employment_type_desc: data.employment_type_desc || `${data.employment_type_name} employment type`,
                      status: 'active',
                      created_at: new Date(),
                      updated_at: new Date()
                    },
                  });
                  
                  data.employment_type_id = newEmploymentType.employment_type_id;
                  logger.info({
                    message: `Created new employment type for Employee`,
                    metadata: {
                      employee_id: data.employee_id,
                      employment_type_id: newEmploymentType.employment_type_id,
                      employment_type_name: data.employment_type_name,
                      timestamp: new Date().toISOString(),
                    },
                  });
                }
              } catch (typeError) {
                logger.error({
                  message: `Failed to find or create employment type for Employee`,
                  metadata: {
                    error: typeError.message,
                    stack: typeError.stack,
                    employee_id: data.employee_id,
                    org_id: data.org_id,
                    employment_type_name: data.employment_type_name,
                    timestamp: new Date().toISOString(),
                  },
                });
                // Set to null as fallback
                data.employment_type_id = null;
              }
            } else {
              // Set to null if we don't have enough info to create
              data.employment_type_id = null;
              logger.warn({
                message: `Setting employment_type_id to null for Employee - missing required information to create employment type`,
                metadata: {
                  employee_id: data.employee_id,
                  timestamp: new Date().toISOString(),
                },
              });
            }
          }
        } catch (error) {
          logger.error({
            message: `Error checking employment type reference for Employee`,
            metadata: {
              error: error.message,
              stack: error.stack,
              employee_id: data.employee_id,
              employment_type_id: data.employment_type_id,
              timestamp: new Date().toISOString(),
            },
          });
          // Set to null in case of error
          data.employment_type_id = null;
        }
      }

      // Format date fields for Employee
      const dateFields = ['hire_date', 'termination_date', 'date_of_birth', 'created_at', 'updated_at'];
      for (const field of dateFields) {
        if (data[field]) {
          try {
            data[field] = new Date(data[field]);
            if (isNaN(data[field].getTime())) {
              logger.warn({
                message: `Invalid date format for ${field} in Employee, setting to null`,
                metadata: {
                  employee_id: data.employee_id,
                  field: field,
                  value: data[field],
                  timestamp: new Date().toISOString(),
                },
              });
              data[field] = null;
            }
          } catch (error) {
            logger.error({
              message: `Error formatting date field ${field} for Employee`,
              metadata: {
                error: error.message,
                employee_id: data.employee_id,
                field: field,
                value: data[field],
                timestamp: new Date().toISOString(),
              },
            });
            data[field] = null;
          }
        }
      }

      // Check manager_id if present
      if (data.manager_id) {
        try {
          const manager = await prisma.Employee.findUnique({
            where: { employee_id: data.manager_id },
          });

          if (!manager) {
            logger.warn({
              message: `Manager Employee with ID ${data.manager_id} not found for Employee, setting to null`,
              metadata: {
                employee_id: data.employee_id,
                manager_id: data.manager_id,
                timestamp: new Date().toISOString(),
              },
            });
            // Set to null to avoid foreign key constraint errors
            data.manager_id = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking manager reference for Employee`,
            metadata: {
              error: error.message,
              stack: error.stack,
              employee_id: data.employee_id,
              manager_id: data.manager_id,
              timestamp: new Date().toISOString(),
            },
          });
          // Set to null in case of error
          data.manager_id = null;
        }
      }
    }
    // Special handling for EmployeeShiftAssignment model
    else if (objectType === "employee-shift-assignments") {
      // First set up the whereCondition properly for the upsert operation
      if (data.assignment_id) {
        // Use primary key if available
        whereCondition = { assignment_id: data.assignment_id };
        logger.info({
          message: `Using primary key for EmployeeShiftAssignment upsert`,
          metadata: {
            assignment_id: data.assignment_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else if (data.employee_id && data.shift_id) {
        // Use the combination of employee_id and shift_id as unique identifier
        whereCondition = {
          employee_id_shift_id: {
            employee_id: data.employee_id,
            shift_id: data.shift_id,
          },
        };
        logger.info({
          message: `Using employee_id and shift_id combination for EmployeeShiftAssignment upsert`,
          metadata: {
            employee_id: data.employee_id,
            shift_id: data.shift_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for EmployeeShiftAssignment`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier for EmployeeShiftAssignment: need either assignment_id or both employee_id and shift_id",
          data: null,
        });
      }

      // Handle employee_id foreign key reference
      if (data.employee_id) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.employee_id },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.employee_id} not found for EmployeeShiftAssignment`,
              metadata: {
                assignment_id: data.assignment_id,
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
            // Cannot proceed if employee doesn't exist
            return res.status(400).json({
              status: "error",
              message: `Invalid employee_id: Employee not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee reference for EmployeeShiftAssignment`,
            metadata: {
              error: error.message,
              assignment_id: data.assignment_id,
              employee_id: data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error validating employee reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required employee_id for EmployeeShiftAssignment`,
          metadata: {
            assignment_id: data.assignment_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Missing required employee_id for EmployeeShiftAssignment`,
          data: null,
        });
      }

      // Handle shift_id foreign key reference
      if (data.shift_id) {
        try {
          const shift = await prisma.ShiftConfiguration.findUnique({
            where: { shift_id: data.shift_id },
          });

          if (!shift) {
            logger.error({
              message: `ShiftConfiguration with ID ${data.shift_id} not found for EmployeeShiftAssignment`,
              metadata: {
                assignment_id: data.assignment_id,
                shift_id: data.shift_id,
                timestamp: new Date().toISOString(),
              },
            });
            // Cannot proceed if shift doesn't exist
            return res.status(400).json({
              status: "error",
              message: `Invalid shift_id: ShiftConfiguration not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking shift reference for EmployeeShiftAssignment`,
            metadata: {
              error: error.message,
              assignment_id: data.assignment_id,
              shift_id: data.shift_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error validating shift reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required shift_id for EmployeeShiftAssignment`,
          metadata: {
            assignment_id: data.assignment_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Missing required shift_id for EmployeeShiftAssignment`,
          data: null,
        });
      }

      // Handle created_by and updated_by references
      if (data.created_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.created_by },
          });

          if (!employee) {
            logger.warn({
              message: `Employee with ID ${data.created_by} not found for created_by, setting to null`,
              metadata: {
                assignment_id: data.assignment_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.created_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee reference for EmployeeShiftAssignment created_by`,
            metadata: {
              error: error.message,
              assignment_id: data.assignment_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.created_by = null;
        }
      }

      if (data.updated_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.updated_by },
          });

          if (!employee) {
            logger.warn({
              message: `Employee with ID ${data.updated_by} not found for updated_by, setting to null`,
              metadata: {
                assignment_id: data.assignment_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.updated_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee reference for EmployeeShiftAssignment updated_by`,
            metadata: {
              error: error.message,
              assignment_id: data.assignment_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.updated_by = null;
        }
      }
    }
    // Special handling for employee-shift-assignments model
    else if (objectType === "employee-shift-assignments") {
      // First set up the whereCondition properly for the upsert operation
      if (data.assignment_id) {
        // Use primary key if available
        whereCondition = { assignment_id: data.assignment_id };
        logger.info({
          message: `Using primary key for EmployeeShiftAssignment upsert`,
          metadata: {
            assignment_id: data.assignment_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for EmployeeShiftAssignment`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier assignment_id for EmployeeShiftAssignment",
          data: null,
        });
      }

      // Verify that employee_id exists as it's a required foreign key
      if (data.employee_id) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.employee_id },
          });

          if (!employee) {
            // Check if this is a deferred object that should be retried later
            // when employee might be available
            if (req.body.deferredProcessing === true) {
              logger.warn({
                message: `Employee with ID ${data.employee_id} not found for EmployeeShiftAssignment, but this is a deferred object so it will be retried later`,
                metadata: {
                  assignment_id: data.assignment_id,
                  employee_id: data.employee_id,
                  timestamp: new Date().toISOString(),
                },
              });
              // Return 429 to indicate this should be retried later
              return res.status(429).json({
                status: "deferred",
                message: `Employee with ID ${data.employee_id} not found, deferring processing`,
                data: null,
              });
            } else {
              logger.error({
                message: `Employee with ID ${data.employee_id} not found for EmployeeShiftAssignment`,
                metadata: {
                  assignment_id: data.assignment_id,
                  employee_id: data.employee_id,
                  timestamp: new Date().toISOString(),
                },
              });
              return res.status(400).json({
                status: "error",
                message: `Invalid employee_id: Employee not found`,
                data: null,
              });
            }
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee reference for EmployeeShiftAssignment`,
            metadata: {
              error: error.message,
              stack: error.stack,
              assignment_id: data.assignment_id,
              employee_id: data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking employee reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required employee_id for EmployeeShiftAssignment`,
          metadata: {
            assignment_id: data.assignment_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required employee_id for EmployeeShiftAssignment",
          data: null,
        });
      }

      // Verify that shift_id exists as it's a required foreign key
      if (data.shift_id) {
        try {
          const shift = await prisma.ShiftConfiguration.findUnique({
            where: { shift_id: data.shift_id },
          });

          if (!shift) {
            // Check if this is a deferred object that should be retried later
            // when shift configuration might be available
            if (req.body.deferredProcessing === true) {
              logger.warn({
                message: `ShiftConfiguration with ID ${data.shift_id} not found for EmployeeShiftAssignment, but this is a deferred object so it will be retried later`,
                metadata: {
                  assignment_id: data.assignment_id,
                  shift_id: data.shift_id,
                  timestamp: new Date().toISOString(),
                },
              });
              // Return 429 to indicate this should be retried later
              return res.status(429).json({
                status: "deferred",
                message: `ShiftConfiguration with ID ${data.shift_id} not found, deferring processing`,
                data: null,
              });
            } else {
              logger.error({
                message: `ShiftConfiguration with ID ${data.shift_id} not found for EmployeeShiftAssignment`,
                metadata: {
                  assignment_id: data.assignment_id,
                  shift_id: data.shift_id,
                  timestamp: new Date().toISOString(),
                },
              });
              return res.status(400).json({
                status: "error",
                message: `Invalid shift_id: ShiftConfiguration not found`,
                data: null,
              });
            }
          }
        } catch (error) {
          logger.error({
            message: `Error checking shift configuration reference for EmployeeShiftAssignment`,
            metadata: {
              error: error.message,
              stack: error.stack,
              assignment_id: data.assignment_id,
              shift_id: data.shift_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking shift configuration reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required shift_id for EmployeeShiftAssignment`,
          metadata: {
            assignment_id: data.assignment_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required shift_id for EmployeeShiftAssignment",
          data: null,
        });
      }

      // Format effective_from date field (required)
      if (data.effective_from) {
        try {
          data.effective_from = new Date(data.effective_from);
          if (isNaN(data.effective_from.getTime())) {
            logger.error({
              message: `Invalid date format for effective_from: ${data.effective_from}`,
              metadata: {
                assignment_id: data.assignment_id,
                effective_from: data.effective_from,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid date format for effective_from: ${data.effective_from}`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error parsing effective_from date for EmployeeShiftAssignment`,
            metadata: {
              error: error.message,
              stack: error.stack,
              assignment_id: data.assignment_id,
              effective_from: data.effective_from,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Error parsing effective_from date: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required effective_from for EmployeeShiftAssignment`,
          metadata: {
            assignment_id: data.assignment_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required effective_from for EmployeeShiftAssignment",
          data: null,
        });
      }

      // Format effective_to date field (optional)
      if (data.effective_to) {
        try {
          data.effective_to = new Date(data.effective_to);
          if (isNaN(data.effective_to.getTime())) {
            logger.error({
              message: `Invalid date format for effective_to: ${data.effective_to}`,
              metadata: {
                assignment_id: data.assignment_id,
                effective_to: data.effective_to,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid date format for effective_to: ${data.effective_to}`,
              data: null,
            });
          }

          // Validate that effective_to is after effective_from
          if (data.effective_to < data.effective_from) {
            logger.error({
              message: `effective_to date cannot be before effective_from date`,
              metadata: {
                assignment_id: data.assignment_id,
                effective_from: data.effective_from.toISOString(),
                effective_to: data.effective_to.toISOString(),
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: "effective_to date cannot be before effective_from date",
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error parsing effective_to date for EmployeeShiftAssignment`,
            metadata: {
              error: error.message,
              stack: error.stack,
              assignment_id: data.assignment_id,
              effective_to: data.effective_to,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Error parsing effective_to date: ${error.message}`,
            data: null,
          });
        }
      }

      // Format created_at date field
      if (data.created_at) {
        try {
          data.created_at = new Date(data.created_at);
          if (isNaN(data.created_at.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for created_at: ${data.created_at}`,
            metadata: {
              assignment_id: data.assignment_id,
              created_at: data.created_at,
              timestamp: new Date().toISOString(),
            },
          });
          // Use default value instead of failing
          data.created_at = new Date();
          logger.warn({
            message: `Using current date as fallback for invalid created_at`,
            metadata: {
              assignment_id: data.assignment_id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Format updated_at date field
      if (data.updated_at) {
        try {
          data.updated_at = new Date(data.updated_at);
          if (isNaN(data.updated_at.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for updated_at: ${data.updated_at}`,
            metadata: {
              assignment_id: data.assignment_id,
              updated_at: data.updated_at,
              timestamp: new Date().toISOString(),
            },
          });
          // Use default value instead of failing
          data.updated_at = new Date();
          logger.warn({
            message: `Using current date as fallback for invalid updated_at`,
            metadata: {
              assignment_id: data.assignment_id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Verify that created_by employee exists if provided
      if (data.created_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.created_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.created_by} not found for EmployeeShiftAssignment created_by`,
              metadata: {
                assignment_id: data.assignment_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since created_by is optional
            logger.warn({
              message: `Invalid created_by: Employee not found, setting to null`,
              metadata: {
                assignment_id: data.assignment_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.created_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking created_by employee reference for EmployeeShiftAssignment`,
            metadata: {
              error: error.message,
              stack: error.stack,
              assignment_id: data.assignment_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since created_by is optional
          logger.warn({
            message: `Error checking created_by employee reference, setting to null: ${error.message}`,
            metadata: {
              assignment_id: data.assignment_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.created_by = null;
        }
      }

      // Verify that updated_by employee exists if provided
      if (data.updated_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.updated_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.updated_by} not found for EmployeeShiftAssignment updated_by`,
              metadata: {
                assignment_id: data.assignment_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since updated_by is optional
            logger.warn({
              message: `Invalid updated_by: Employee not found, setting to null`,
              metadata: {
                assignment_id: data.assignment_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.updated_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking updated_by employee reference for EmployeeShiftAssignment`,
            metadata: {
              error: error.message,
              stack: error.stack,
              assignment_id: data.assignment_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since updated_by is optional
          logger.warn({
            message: `Error checking updated_by employee reference, setting to null: ${error.message}`,
            metadata: {
              assignment_id: data.assignment_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.updated_by = null;
        }
      }
    }
    // Special handling for attendance-settings model
    else if (objectType === "attendance-settings") {
      // First set up the whereCondition properly for the upsert operation
      if (data.id) {
        // Use primary key if available
        whereCondition = { id: data.id };
        logger.info({
          message: `Using primary key for AttendanceSettings upsert`,
          metadata: {
            id: data.id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for AttendanceSettings`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier id for AttendanceSettings",
          data: null,
        });
      }

      // Verify that organizationId exists as it's a required foreign key
      if (data.organizationId) {
        try {
          const organization = await prisma.Organization.findUnique({
            where: { org_id: data.organizationId },
          });

          if (!organization) {
            logger.error({
              message: `Organization with ID ${data.organizationId} not found for AttendanceSettings`,
              metadata: {
                id: data.id,
                organizationId: data.organizationId,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid organizationId: Organization not found`,
              data: null,
            });
          }

          // Check unique constraint on organizationId
          const existingSettings = await prisma.AttendanceSettings.findFirst({
            where: {
              organizationId: data.organizationId,
              NOT: { id: data.id },
            },
          });

          if (existingSettings) {
            logger.error({
              message: `Unique constraint violation: AttendanceSettings for this organization already exists`,
              metadata: {
                id: data.id,
                organizationId: data.organizationId,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Unique constraint violation: AttendanceSettings for this organization already exists`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking organization reference for AttendanceSettings`,
            metadata: {
              error: error.message,
              stack: error.stack,
              id: data.id,
              organizationId: data.organizationId,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking organization reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required organizationId for AttendanceSettings`,
          metadata: {
            id: data.id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required organizationId for AttendanceSettings",
          data: null,
        });
      }

      // Verify that moduleId exists as it's a required foreign key
      if (data.moduleId) {
        try {
          const policyModule = await prisma.PolicyModule.findUnique({
            where: { module_id: data.moduleId },
          });

          if (!policyModule) {
            logger.error({
              message: `PolicyModule with ID ${data.moduleId} not found for AttendanceSettings`,
              metadata: {
                id: data.id,
                moduleId: data.moduleId,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid moduleId: PolicyModule not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking policy module reference for AttendanceSettings`,
            metadata: {
              error: error.message,
              stack: error.stack,
              id: data.id,
              moduleId: data.moduleId,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking policy module reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required moduleId for AttendanceSettings`,
          metadata: {
            id: data.id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required moduleId for AttendanceSettings",
          data: null,
        });
      }

      // Validate and process captureMethods array field
      if (data.captureMethods) {
        if (!Array.isArray(data.captureMethods)) {
          // Convert to array if it's not already
          try {
            data.captureMethods = JSON.parse(data.captureMethods);
            if (!Array.isArray(data.captureMethods)) {
              data.captureMethods = [data.captureMethods];
            }
          } catch (e) {
            // If JSON parsing fails, try treating it as a single value
            data.captureMethods = [data.captureMethods];
          }
        }

        // Validate each method is a valid enum value
        const validCaptureMethods = [
          "web_app",
          "mobile_app",
          "biometric",
          "rfid",
          "qr_code",
        ];
        for (const method of data.captureMethods) {
          if (!validCaptureMethods.includes(method)) {
            logger.error({
              message: `Invalid capture method in captureMethods: ${method}`,
              metadata: {
                id: data.id,
                invalidMethod: method,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid capture method: ${method}. Valid values are: ${validCaptureMethods.join(", ")}`,
              data: null,
            });
          }
        }
      } else {
        // Set default if not provided
        data.captureMethods = ["web_app"];
      }

      // Handle boolean fields
      const booleanFields = [
        "geoFencingEnabled",
        "overtimePolicyEnabled",
        "autoCheckoutEnabled",
        "regularizationAllowed",
      ];
      for (const field of booleanFields) {
        if (data[field] !== undefined) {
          data[field] = Boolean(data[field]);
        }
      }

      // Handle integer fields
      const intFields = [
        "geoFenceRadius",
        "flexibleHours",
        "gracePeriodMinutes",
        "breakDurationMinutes",
        "workDaysPerWeek",
        "minimumOvertimeMinutes",
        "maxOvertimeHoursMonthly",
        "regularizationWindowDays",
        "regularizationLimitMonthly",
      ];

      for (const field of intFields) {
        if (data[field] !== undefined && data[field] !== null) {
          if (isNaN(parseInt(data[field]))) {
            logger.error({
              message: `Invalid integer format for ${field} in AttendanceSettings: ${data[field]}`,
              metadata: {
                id: data.id,
                [field]: data[field],
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid integer format for ${field}: ${data[field]}`,
              data: null,
            });
          }

          // Convert to number
          data[field] = parseInt(data[field]);
        }
      }

      // Handle decimal fields
      const decimalFields = [
        "halfDayHours",
        "fullDayHours",
        "weekendOvertimeMultiplier",
        "holidayOvertimeMultiplier",
      ];
      for (const field of decimalFields) {
        if (data[field] !== undefined && data[field] !== null) {
          try {
            // Convert to Decimal for Prisma
            data[field] = new Prisma.Decimal(data[field]);
          } catch (error) {
            logger.error({
              message: `Invalid decimal format for ${field} in AttendanceSettings: ${data[field]}`,
              metadata: {
                id: data.id,
                [field]: data[field],
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid decimal format for ${field}: ${data[field]}`,
              data: null,
            });
          }
        }
      }

      // Handle time fields - in PostgreSQL, TIME type doesn't include timezone information
      const timeFields = ["shiftStartTime", "shiftEndTime", "autoCheckoutTime"];
      for (const field of timeFields) {
        if (data[field]) {
          try {
            const date = new Date(data[field]);
            if (isNaN(date.getTime())) {
              throw new Error("Invalid date format");
            }

            // For TIME fields, we only need the time part, not the date or timezone
            // Format as HH:MM:SS
            const hours = date.getUTCHours().toString().padStart(2, "0");
            const minutes = date.getUTCMinutes().toString().padStart(2, "0");
            const seconds = date.getUTCSeconds().toString().padStart(2, "0");
            data[field] = `${hours}:${minutes}:${seconds}`;
          } catch (error) {
            logger.error({
              message: `Invalid time format for ${field} in AttendanceSettings: ${data[field]}`,
              metadata: {
                id: data.id,
                [field]: data[field],
                timestamp: new Date().toISOString(),
              },
            });
            // For time fields, we'll set to null if invalid
            data[field] = null;
            logger.warn({
              message: `Setting ${field} to null due to invalid format`,
              metadata: {
                id: data.id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Validate shiftType field against ShiftType enum
      if (
        data.shiftType &&
        !["fixed", "flexible", "rotational"].includes(data.shiftType)
      ) {
        logger.error({
          message: `Invalid shiftType value for AttendanceSettings: ${data.shiftType}`,
          metadata: {
            id: data.id,
            shiftType: data.shiftType,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid shiftType value: ${data.shiftType}. Must be one of: fixed, flexible, rotational`,
          data: null,
        });
      }

      // Validate overtimeCalculationType field against OvertimeCalculationType enum
      if (
        data.overtimeCalculationType &&
        !["none", "daily", "weekly", "monthly"].includes(
          data.overtimeCalculationType
        )
      ) {
        logger.error({
          message: `Invalid overtimeCalculationType value for AttendanceSettings: ${data.overtimeCalculationType}`,
          metadata: {
            id: data.id,
            overtimeCalculationType: data.overtimeCalculationType,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid overtimeCalculationType value: ${data.overtimeCalculationType}. Must be one of: none, daily, weekly, monthly`,
          data: null,
        });
      }

      // Validate latePenaltyType field against PenaltyType enum
      if (
        data.latePenaltyType &&
        !["none", "leave_deduction", "salary_deduction", "warning"].includes(
          data.latePenaltyType
        )
      ) {
        logger.error({
          message: `Invalid latePenaltyType value for AttendanceSettings: ${data.latePenaltyType}`,
          metadata: {
            id: data.id,
            latePenaltyType: data.latePenaltyType,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid latePenaltyType value: ${data.latePenaltyType}. Must be one of: none, leave_deduction, salary_deduction, warning`,
          data: null,
        });
      }

      // Validate latePenaltyLeaveType field against LeaveType enum
      if (
        data.latePenaltyLeaveType &&
        ![
          "none",
          "casual",
          "sick",
          "earned",
          "maternity",
          "paternity",
          "bereavement",
          "unpaid",
          "comp_off",
          "other",
        ].includes(data.latePenaltyLeaveType)
      ) {
        logger.error({
          message: `Invalid latePenaltyLeaveType value for AttendanceSettings: ${data.latePenaltyLeaveType}`,
          metadata: {
            id: data.id,
            latePenaltyLeaveType: data.latePenaltyLeaveType,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid latePenaltyLeaveType value: ${data.latePenaltyLeaveType}. Must be one of: none, casual, sick, earned, maternity, paternity, bereavement, unpaid, comp_off, other`,
          data: null,
        });
      }

      // Validate status field against Status enum
      if (data.status && !["active", "inactive"].includes(data.status)) {
        logger.error({
          message: `Invalid status value for AttendanceSettings: ${data.status}`,
          metadata: {
            id: data.id,
            status: data.status,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid status value: ${data.status}. Must be one of: active, inactive`,
          data: null,
        });
      }

      // Format date fields
      if (data.createdAt) {
        try {
          data.createdAt = new Date(data.createdAt);
          if (isNaN(data.createdAt.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for createdAt: ${data.createdAt}`,
            metadata: {
              id: data.id,
              createdAt: data.createdAt,
              timestamp: new Date().toISOString(),
            },
          });
          // Use default value instead of failing
          data.createdAt = new Date();
          logger.warn({
            message: `Using current date as fallback for invalid createdAt`,
            metadata: {
              id: data.id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      if (data.updatedAt) {
        try {
          data.updatedAt = new Date(data.updatedAt);
          if (isNaN(data.updatedAt.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for updatedAt: ${data.updatedAt}`,
            metadata: {
              id: data.id,
              updatedAt: data.updatedAt,
              timestamp: new Date().toISOString(),
            },
          });
          // Use default value instead of failing
          data.updatedAt = new Date();
          logger.warn({
            message: `Using current date as fallback for invalid updatedAt`,
            metadata: {
              id: data.id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Verify that createdBy employee exists if provided
      if (data.createdBy) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.createdBy },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.createdBy} not found for AttendanceSettings createdBy`,
              metadata: {
                id: data.id,
                createdBy: data.createdBy,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since createdBy is optional
            logger.warn({
              message: `Invalid createdBy: Employee not found, setting to null`,
              metadata: {
                id: data.id,
                createdBy: data.createdBy,
                timestamp: new Date().toISOString(),
              },
            });
            data.createdBy = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking createdBy employee reference for AttendanceSettings`,
            metadata: {
              error: error.message,
              stack: error.stack,
              id: data.id,
              createdBy: data.createdBy,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since createdBy is optional
          logger.warn({
            message: `Error checking createdBy employee reference, setting to null: ${error.message}`,
            metadata: {
              id: data.id,
              createdBy: data.createdBy,
              timestamp: new Date().toISOString(),
            },
          });
          data.createdBy = null;
        }
      }

      // Verify that updatedBy employee exists if provided
      if (data.updatedBy) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.updatedBy },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.updatedBy} not found for AttendanceSettings updatedBy`,
              metadata: {
                id: data.id,
                updatedBy: data.updatedBy,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since updatedBy is optional
            logger.warn({
              message: `Invalid updatedBy: Employee not found, setting to null`,
              metadata: {
                id: data.id,
                updatedBy: data.updatedBy,
                timestamp: new Date().toISOString(),
              },
            });
            data.updatedBy = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking updatedBy employee reference for AttendanceSettings`,
            metadata: {
              error: error.message,
              stack: error.stack,
              id: data.id,
              updatedBy: data.updatedBy,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since updatedBy is optional
          logger.warn({
            message: `Error checking updatedBy employee reference, setting to null: ${error.message}`,
            metadata: {
              id: data.id,
              updatedBy: data.updatedBy,
              timestamp: new Date().toISOString(),
            },
          });
          data.updatedBy = null;
        }
      }
    }
    // Special handling for holiday-calendar-details model
    else if (objectType === "holiday-calendar-details") {
      // First set up the whereCondition properly for the upsert operation
      if (data.calendar_detail_id) {
        // Use primary key if available
        whereCondition = { calendar_detail_id: data.calendar_detail_id };
        logger.info({
          message: `Using primary key for HolidayCalendarDetail upsert`,
          metadata: {
            calendar_detail_id: data.calendar_detail_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for HolidayCalendarDetail`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier calendar_detail_id for HolidayCalendarDetail",
          data: null,
        });
      }

      // Verify that calendar_id exists as it's a required foreign key
      if (data.calendar_id) {
        try {
          const holidayCalendar = await prisma.HolidayCalendarYear.findUnique({
            where: { calendar_id: data.calendar_id },
          });

          if (!holidayCalendar) {
            logger.error({
              message: `HolidayCalendarYear with ID ${data.calendar_id} not found for HolidayCalendarDetail`,
              metadata: {
                calendar_detail_id: data.calendar_detail_id,
                calendar_id: data.calendar_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid calendar_id: HolidayCalendarYear not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking calendar reference for HolidayCalendarDetail`,
            metadata: {
              error: error.message,
              stack: error.stack,
              calendar_detail_id: data.calendar_detail_id,
              calendar_id: data.calendar_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking calendar reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required calendar_id for HolidayCalendarDetail`,
          metadata: {
            calendar_detail_id: data.calendar_detail_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required calendar_id for HolidayCalendarDetail",
          data: null,
        });
      }

      // Verify that holiday_id exists as it's a required foreign key
      if (data.holiday_id) {
        try {
          const holidayMaster = await prisma.HolidayMaster.findUnique({
            where: { holiday_id: data.holiday_id },
          });

          if (!holidayMaster) {
            logger.error({
              message: `HolidayMaster with ID ${data.holiday_id} not found for HolidayCalendarDetail`,
              metadata: {
                calendar_detail_id: data.calendar_detail_id,
                holiday_id: data.holiday_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid holiday_id: HolidayMaster not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking holiday reference for HolidayCalendarDetail`,
            metadata: {
              error: error.message,
              stack: error.stack,
              calendar_detail_id: data.calendar_detail_id,
              holiday_id: data.holiday_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking holiday reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required holiday_id for HolidayCalendarDetail`,
          metadata: {
            calendar_detail_id: data.calendar_detail_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required holiday_id for HolidayCalendarDetail",
          data: null,
        });
      }

      // Check unique constraint on calendar_id and holiday_date
      if (data.holiday_date) {
        try {
          // Format holiday_date
          data.holiday_date = new Date(data.holiday_date);
          if (isNaN(data.holiday_date.getTime())) {
            logger.error({
              message: `Invalid date format for holiday_date: ${data.holiday_date}`,
              metadata: {
                calendar_detail_id: data.calendar_detail_id,
                holiday_date: data.holiday_date,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid date format for holiday_date: ${data.holiday_date}`,
              data: null,
            });
          }

          // Check unique constraint violation
          const existingCalendarDetail =
            await prisma.HolidayCalendarDetail.findFirst({
              where: {
                calendar_id: data.calendar_id,
                holiday_date: data.holiday_date,
                NOT: { calendar_detail_id: data.calendar_detail_id },
              },
            });

          if (existingCalendarDetail) {
            logger.error({
              message: `Unique constraint violation: HolidayCalendarDetail for this calendar and date already exists`,
              metadata: {
                calendar_detail_id: data.calendar_detail_id,
                calendar_id: data.calendar_id,
                holiday_date: data.holiday_date.toISOString(),
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Unique constraint violation: HolidayCalendarDetail for this calendar and date already exists`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking unique constraint for HolidayCalendarDetail (calendar_id + holiday_date)`,
            metadata: {
              error: error.message,
              stack: error.stack,
              calendar_detail_id: data.calendar_detail_id,
              calendar_id: data.calendar_id,
              holiday_date: data.holiday_date,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking unique constraint (calendar_id + holiday_date): ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required holiday_date for HolidayCalendarDetail`,
          metadata: {
            calendar_detail_id: data.calendar_detail_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required holiday_date for HolidayCalendarDetail",
          data: null,
        });
      }

      // Handle boolean fields
      if (data.is_half_day !== undefined) {
        data.is_half_day = Boolean(data.is_half_day);
      } else {
        // Set default if not provided
        data.is_half_day = false;
      }

      // Validate half_day_type field against HalfDayType enum
      if (
        data.half_day_type &&
        !["none", "first_half", "second_half"].includes(data.half_day_type)
      ) {
        logger.error({
          message: `Invalid half_day_type value for HolidayCalendarDetail: ${data.half_day_type}`,
          metadata: {
            calendar_detail_id: data.calendar_detail_id,
            half_day_type: data.half_day_type,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid half_day_type value for HolidayCalendarDetail: ${data.half_day_type}. Must be one of: none, first_half, second_half`,
          data: null,
        });
      } else if (!data.half_day_type) {
        // Set default if not provided
        data.half_day_type = "none";
      }

      // Format date fields
      if (data.created_at) {
        try {
          data.created_at = new Date(data.created_at);
          if (isNaN(data.created_at.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for created_at: ${data.created_at}`,
            metadata: {
              calendar_detail_id: data.calendar_detail_id,
              created_at: data.created_at,
              timestamp: new Date().toISOString(),
            },
          });
          // Use default value instead of failing
          data.created_at = new Date();
          logger.warn({
            message: `Using current date as fallback for invalid created_at`,
            metadata: {
              calendar_detail_id: data.calendar_detail_id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      if (data.updated_at) {
        try {
          data.updated_at = new Date(data.updated_at);
          if (isNaN(data.updated_at.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for updated_at: ${data.updated_at}`,
            metadata: {
              calendar_detail_id: data.calendar_detail_id,
              updated_at: data.updated_at,
              timestamp: new Date().toISOString(),
            },
          });
          // Use default value instead of failing
          data.updated_at = new Date();
          logger.warn({
            message: `Using current date as fallback for invalid updated_at`,
            metadata: {
              calendar_detail_id: data.calendar_detail_id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
    }
    // Special handling for leave-policy-configurations model
    else if (objectType === "leave-policy-configurations") {
      // First set up the whereCondition properly for the upsert operation
      if (data.config_id) {
        // Use primary key if available
        whereCondition = { config_id: data.config_id };
        logger.info({
          message: `Using primary key for LeavePolicyConfiguration upsert`,
          metadata: {
            config_id: data.config_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for LeavePolicyConfiguration`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier config_id for LeavePolicyConfiguration",
          data: null,
        });
      }

      // Verify that org_id exists as it's a required foreign key
      if (data.org_id) {
        try {
          const organization = await prisma.Organization.findUnique({
            where: { org_id: data.org_id },
          });

          if (!organization) {
            logger.error({
              message: `Organization with ID ${data.org_id} not found for LeavePolicyConfiguration`,
              metadata: {
                config_id: data.config_id,
                org_id: data.org_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid org_id: Organization not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking organization reference for LeavePolicyConfiguration`,
            metadata: {
              error: error.message,
              stack: error.stack,
              config_id: data.config_id,
              org_id: data.org_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking organization reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required org_id for LeavePolicyConfiguration`,
          metadata: {
            config_id: data.config_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required org_id for LeavePolicyConfiguration",
          data: null,
        });
      }

      // Verify that module_id exists as it's a required foreign key
      if (data.module_id) {
        try {
          const policyModule = await prisma.PolicyModule.findUnique({
            where: { module_id: data.module_id },
          });

          if (!policyModule) {
            logger.error({
              message: `PolicyModule with ID ${data.module_id} not found for LeavePolicyConfiguration`,
              metadata: {
                config_id: data.config_id,
                module_id: data.module_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid module_id: PolicyModule not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking policy module reference for LeavePolicyConfiguration`,
            metadata: {
              error: error.message,
              stack: error.stack,
              config_id: data.config_id,
              module_id: data.module_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking policy module reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required module_id for LeavePolicyConfiguration`,
          metadata: {
            config_id: data.config_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required module_id for LeavePolicyConfiguration",
          data: null,
        });
      }

      // Validate leave_type field against LeaveType enum
      if (
        data.leave_type &&
        ![
          "casual",
          "sick",
          "earned",
          "maternity",
          "paternity",
          "bereavement",
          "unpaid",
          "comp_off",
          "other",
        ].includes(data.leave_type)
      ) {
        logger.error({
          message: `Invalid leave_type value for LeavePolicyConfiguration: ${data.leave_type}`,
          metadata: {
            config_id: data.config_id,
            leave_type: data.leave_type,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid leave_type value for LeavePolicyConfiguration: ${data.leave_type}. Must be one of: casual, sick, earned, maternity, paternity, bereavement, unpaid, comp_off, other`,
          data: null,
        });
      } else if (!data.leave_type) {
        // Set default if not provided
        data.leave_type = "casual";
      }

      // Check unique combination of org_id and leave_type
      try {
        const existingConfig = await prisma.LeavePolicyConfiguration.findFirst({
          where: {
            org_id: data.org_id,
            leave_type: data.leave_type,
            NOT: { config_id: data.config_id },
          },
        });

        if (existingConfig) {
          logger.error({
            message: `Unique constraint violation: LeavePolicyConfiguration for this organization and leave type already exists`,
            metadata: {
              config_id: data.config_id,
              org_id: data.org_id,
              leave_type: data.leave_type,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Unique constraint violation: LeavePolicyConfiguration for this organization and leave type already exists`,
            data: null,
          });
        }
      } catch (error) {
        logger.error({
          message: `Error checking unique constraint for LeavePolicyConfiguration (org_id + leave_type)`,
          metadata: {
            error: error.message,
            stack: error.stack,
            config_id: data.config_id,
            org_id: data.org_id,
            leave_type: data.leave_type,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(500).json({
          status: "error",
          message: `Error checking unique constraint (org_id + leave_type): ${error.message}`,
          data: null,
        });
      }

      // Validate accrual_frequency field against LeaveAccrualFrequency enum
      if (
        data.accrual_frequency &&
        !["monthly", "quarterly", "bi_annual", "annual", "daily"].includes(
          data.accrual_frequency
        )
      ) {
        logger.error({
          message: `Invalid accrual_frequency value for LeavePolicyConfiguration: ${data.accrual_frequency}`,
          metadata: {
            config_id: data.config_id,
            accrual_frequency: data.accrual_frequency,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid accrual_frequency value for LeavePolicyConfiguration: ${data.accrual_frequency}. Must be one of: monthly, quarterly, bi_annual, annual, daily`,
          data: null,
        });
      } else if (!data.accrual_frequency) {
        // Set default if not provided
        data.accrual_frequency = "monthly";
      }

      // Handle days_per_year which is a Decimal field in the database
      if (data.days_per_year === undefined || data.days_per_year === null) {
        logger.error({
          message: `Missing required days_per_year for LeavePolicyConfiguration`,
          metadata: {
            config_id: data.config_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required days_per_year for LeavePolicyConfiguration",
          data: null,
        });
      } else {
        try {
          // Convert to Decimal for Prisma
          data.days_per_year = new Prisma.Decimal(data.days_per_year);
        } catch (error) {
          logger.error({
            message: `Invalid decimal format for days_per_year in LeavePolicyConfiguration: ${data.days_per_year}`,
            metadata: {
              config_id: data.config_id,
              days_per_year: data.days_per_year,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Invalid decimal format for days_per_year: ${data.days_per_year}`,
            data: null,
          });
        }
      }

      // Handle integer fields
      const intFields = [
        "min_days_per_request",
        "max_days_per_request",
        "min_notice_days",
        "max_carry_forward_days",
        "carry_forward_validity_months",
        "encashment_limit",
        "document_submission_days",
        "applicable_from_months",
      ];

      for (const field of intFields) {
        if (data[field] !== undefined && data[field] !== null) {
          if (isNaN(parseInt(data[field]))) {
            logger.error({
              message: `Invalid integer format for ${field} in LeavePolicyConfiguration: ${data[field]}`,
              metadata: {
                config_id: data.config_id,
                [field]: data[field],
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid integer format for ${field}: ${data[field]}`,
              data: null,
            });
          }

          // Convert to number
          data[field] = parseInt(data[field]);
        }
      }

      // Handle boolean fields
      const booleanFields = [
        "is_encashable",
        "requires_approval",
        "requires_documents",
        "prorata_basis",
      ];
      for (const field of booleanFields) {
        if (data[field] !== undefined) {
          data[field] = Boolean(data[field]);
        }
      }

      // Validate status field against Status enum
      if (data.status && !["active", "inactive"].includes(data.status)) {
        logger.error({
          message: `Invalid status value for LeavePolicyConfiguration: ${data.status}`,
          metadata: {
            config_id: data.config_id,
            status: data.status,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid status value for LeavePolicyConfiguration: ${data.status}. Must be one of: active, inactive`,
          data: null,
        });
      }

      // Verify that created_by employee exists if provided
      if (data.created_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.created_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.created_by} not found for LeavePolicyConfiguration created_by`,
              metadata: {
                config_id: data.config_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since created_by is optional
            logger.warn({
              message: `Invalid created_by: Employee not found, setting to null`,
              metadata: {
                config_id: data.config_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.created_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking created_by employee reference for LeavePolicyConfiguration`,
            metadata: {
              error: error.message,
              stack: error.stack,
              config_id: data.config_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since created_by is optional
          logger.warn({
            message: `Error checking created_by employee reference, setting to null: ${error.message}`,
            metadata: {
              config_id: data.config_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.created_by = null;
        }
      }

      // Verify that updated_by employee exists if provided
      if (data.updated_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.updated_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.updated_by} not found for LeavePolicyConfiguration updated_by`,
              metadata: {
                config_id: data.config_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since updated_by is optional
            logger.warn({
              message: `Invalid updated_by: Employee not found, setting to null`,
              metadata: {
                config_id: data.config_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.updated_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking updated_by employee reference for LeavePolicyConfiguration`,
            metadata: {
              error: error.message,
              stack: error.stack,
              config_id: data.config_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since updated_by is optional
          logger.warn({
            message: `Error checking updated_by employee reference, setting to null: ${error.message}`,
            metadata: {
              config_id: data.config_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.updated_by = null;
        }
      }

      // Format date fields
      if (data.created_at) {
        try {
          data.created_at = new Date(data.created_at);
          if (isNaN(data.created_at.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for created_at: ${data.created_at}`,
            metadata: {
              config_id: data.config_id,
              created_at: data.created_at,
              timestamp: new Date().toISOString(),
            },
          });
          // Use default value instead of failing
          data.created_at = new Date();
          logger.warn({
            message: `Using current date as fallback for invalid created_at`,
            metadata: {
              config_id: data.config_id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      if (data.updated_at) {
        try {
          data.updated_at = new Date(data.updated_at);
          if (isNaN(data.updated_at.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for updated_at: ${data.updated_at}`,
            metadata: {
              config_id: data.config_id,
              updated_at: data.updated_at,
              timestamp: new Date().toISOString(),
            },
          });
          // Use default value instead of failing
          data.updated_at = new Date();
          logger.warn({
            message: `Using current date as fallback for invalid updated_at`,
            metadata: {
              config_id: data.config_id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
    }
    // Special handling for policy-acknowledgments model
    else if (objectType === "policy-acknowledgments") {
      // First set up the whereCondition properly for the upsert operation
      if (data.acknowledgment_id) {
        // Use primary key if available
        whereCondition = { acknowledgment_id: data.acknowledgment_id };
        logger.info({
          message: `Using primary key for PolicyAcknowledgment upsert`,
          metadata: {
            acknowledgment_id: data.acknowledgment_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for PolicyAcknowledgment`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier acknowledgment_id for PolicyAcknowledgment",
          data: null,
        });
      }

      // Verify that version_id exists as it's a required foreign key
      if (data.version_id) {
        try {
          const policyDocVersion =
            await prisma.PolicyDocumentVersion.findUnique({
              where: { version_id: data.version_id },
            });

          if (!policyDocVersion) {
            logger.error({
              message: `PolicyDocumentVersion with ID ${data.version_id} not found for PolicyAcknowledgment`,
              metadata: {
                acknowledgment_id: data.acknowledgment_id,
                version_id: data.version_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid version_id: PolicyDocumentVersion not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking policy document version reference for PolicyAcknowledgment`,
            metadata: {
              error: error.message,
              stack: error.stack,
              acknowledgment_id: data.acknowledgment_id,
              version_id: data.version_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking policy document version reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required version_id for PolicyAcknowledgment`,
          metadata: {
            acknowledgment_id: data.acknowledgment_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required version_id for PolicyAcknowledgment",
          data: null,
        });
      }

      // Verify that employee_id exists as it's a required foreign key
      if (data.employee_id) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.employee_id },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.employee_id} not found for PolicyAcknowledgment`,
              metadata: {
                acknowledgment_id: data.acknowledgment_id,
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid employee_id: Employee not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee reference for PolicyAcknowledgment`,
            metadata: {
              error: error.message,
              stack: error.stack,
              acknowledgment_id: data.acknowledgment_id,
              employee_id: data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking employee reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required employee_id for PolicyAcknowledgment`,
          metadata: {
            acknowledgment_id: data.acknowledgment_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required employee_id for PolicyAcknowledgment",
          data: null,
        });
      }

      // Check unique combination of version_id and employee_id
      try {
        const existingAcknowledgment =
          await prisma.PolicyAcknowledgment.findFirst({
            where: {
              version_id: data.version_id,
              employee_id: data.employee_id,
              NOT: { acknowledgment_id: data.acknowledgment_id },
            },
          });

        if (existingAcknowledgment) {
          logger.error({
            message: `Unique constraint violation: PolicyAcknowledgment for this version and employee already exists`,
            metadata: {
              acknowledgment_id: data.acknowledgment_id,
              version_id: data.version_id,
              employee_id: data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Unique constraint violation: PolicyAcknowledgment for this version and employee already exists`,
            data: null,
          });
        }
      } catch (error) {
        logger.error({
          message: `Error checking unique constraint for PolicyAcknowledgment (version_id + employee_id)`,
          metadata: {
            error: error.message,
            stack: error.stack,
            acknowledgment_id: data.acknowledgment_id,
            version_id: data.version_id,
            employee_id: data.employee_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(500).json({
          status: "error",
          message: `Error checking unique constraint (version_id + employee_id): ${error.message}`,
          data: null,
        });
      }

      // Validate acknowledged_at date field
      if (data.acknowledged_at) {
        try {
          data.acknowledged_at = new Date(data.acknowledged_at);
          if (isNaN(data.acknowledged_at.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for acknowledged_at: ${data.acknowledged_at}`,
            metadata: {
              acknowledgment_id: data.acknowledgment_id,
              acknowledged_at: data.acknowledged_at,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Invalid date format for acknowledged_at: ${data.acknowledged_at}`,
            data: null,
          });
        }
      }

      // Format date fields for created_at and updated_at if provided
      if (data.created_at) {
        try {
          data.created_at = new Date(data.created_at);
          if (isNaN(data.created_at.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for created_at: ${data.created_at}`,
            metadata: {
              acknowledgment_id: data.acknowledgment_id,
              created_at: data.created_at,
              timestamp: new Date().toISOString(),
            },
          });
          // Use default value instead of failing
          data.created_at = new Date();
          logger.warn({
            message: `Using current date as fallback for invalid created_at`,
            metadata: {
              acknowledgment_id: data.acknowledgment_id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      if (data.updated_at) {
        try {
          data.updated_at = new Date(data.updated_at);
          if (isNaN(data.updated_at.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for updated_at: ${data.updated_at}`,
            metadata: {
              acknowledgment_id: data.acknowledgment_id,
              updated_at: data.updated_at,
              timestamp: new Date().toISOString(),
            },
          });
          // Use default value instead of failing
          data.updated_at = new Date();
          logger.warn({
            message: `Using current date as fallback for invalid updated_at`,
            metadata: {
              acknowledgment_id: data.acknowledgment_id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Validate acknowledgment_type field against AcknowledgementType enum
      if (
        data.acknowledgment_type &&
        !["electronic", "manual", "auto"].includes(data.acknowledgment_type)
      ) {
        logger.error({
          message: `Invalid acknowledgment_type value for PolicyAcknowledgment: ${data.acknowledgment_type}`,
          metadata: {
            acknowledgment_id: data.acknowledgment_id,
            acknowledgment_type: data.acknowledgment_type,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid acknowledgment_type value for PolicyAcknowledgment: ${data.acknowledgment_type}. Must be one of: electronic, manual, auto`,
          data: null,
        });
      }
    }
    // Special handling for policy-document-versions model
    else if (objectType === "policy-document-versions") {
      // First set up the whereCondition properly for the upsert operation
      if (data.version_id) {
        // Use primary key if available
        whereCondition = { version_id: data.version_id };
        logger.info({
          message: `Using primary key for PolicyDocumentVersion upsert`,
          metadata: {
            version_id: data.version_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for PolicyDocumentVersion`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier version_id for PolicyDocumentVersion",
          data: null,
        });
      }

      // Verify that module_id exists as it's a required foreign key
      if (data.module_id) {
        try {
          const policyModule = await prisma.PolicyModule.findUnique({
            where: { module_id: data.module_id },
          });

          if (!policyModule) {
            logger.error({
              message: `PolicyModule with ID ${data.module_id} not found for PolicyDocumentVersion`,
              metadata: {
                version_id: data.version_id,
                module_id: data.module_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid module_id: PolicyModule not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking policy module reference for PolicyDocumentVersion`,
            metadata: {
              error: error.message,
              stack: error.stack,
              version_id: data.version_id,
              module_id: data.module_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking policy module reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required module_id for PolicyDocumentVersion`,
          metadata: {
            version_id: data.version_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required module_id for PolicyDocumentVersion",
          data: null,
        });
      }

      // Check version_number requirement
      if (!data.version_number) {
        logger.error({
          message: `Missing required version_number for PolicyDocumentVersion`,
          metadata: {
            version_id: data.version_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required version_number for PolicyDocumentVersion",
          data: null,
        });
      }

      // Check unique combination of module_id and version_number
      try {
        const existingVersion = await prisma.PolicyDocumentVersion.findFirst({
          where: {
            module_id: data.module_id,
            version_number: data.version_number,
            NOT: { version_id: data.version_id },
          },
        });

        if (existingVersion) {
          logger.error({
            message: `Unique constraint violation: PolicyDocumentVersion with version_number ${data.version_number} already exists for module_id ${data.module_id}`,
            metadata: {
              version_id: data.version_id,
              module_id: data.module_id,
              version_number: data.version_number,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Unique constraint violation: PolicyDocumentVersion with version_number ${data.version_number} already exists for module_id ${data.module_id}`,
            data: null,
          });
        }
      } catch (error) {
        logger.error({
          message: `Error checking unique constraint for PolicyDocumentVersion (module_id + version_number)`,
          metadata: {
            error: error.message,
            stack: error.stack,
            version_id: data.version_id,
            module_id: data.module_id,
            version_number: data.version_number,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(500).json({
          status: "error",
          message: `Error checking unique constraint (module_id + version_number): ${error.message}`,
          data: null,
        });
      }

      // Validate effective_from date field which is required
      if (!data.effective_from) {
        logger.error({
          message: `Missing required effective_from date for PolicyDocumentVersion`,
          metadata: {
            version_id: data.version_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required effective_from date for PolicyDocumentVersion",
          data: null,
        });
      } else {
        // Ensure effective_from is a valid date object
        try {
          data.effective_from = new Date(data.effective_from);
          if (isNaN(data.effective_from.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for effective_from: ${data.effective_from}`,
            metadata: {
              version_id: data.version_id,
              effective_from: data.effective_from,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Invalid date format for effective_from: ${data.effective_from}`,
            data: null,
          });
        }
      }

      // Handle optional effective_to date field
      if (data.effective_to) {
        try {
          data.effective_to = new Date(data.effective_to);
          if (isNaN(data.effective_to.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for effective_to: ${data.effective_to}`,
            metadata: {
              version_id: data.version_id,
              effective_to: data.effective_to,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Invalid date format for effective_to: ${data.effective_to}`,
            data: null,
          });
        }
      }

      // Handle optional approved_at date field
      if (data.approved_at) {
        try {
          data.approved_at = new Date(data.approved_at);
          if (isNaN(data.approved_at.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid date format for approved_at: ${data.approved_at}`,
            metadata: {
              version_id: data.version_id,
              approved_at: data.approved_at,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Invalid date format for approved_at: ${data.approved_at}`,
            data: null,
          });
        }
      }

      // Check optional fields with foreign key references
      // Verify that approved_by employee exists if provided
      if (data.approved_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.approved_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.approved_by} not found for PolicyDocumentVersion approved_by`,
              metadata: {
                version_id: data.version_id,
                approved_by: data.approved_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since approved_by is optional
            logger.warn({
              message: `Invalid approved_by: Employee not found, setting to null`,
              metadata: {
                version_id: data.version_id,
                approved_by: data.approved_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.approved_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking approved_by employee reference for PolicyDocumentVersion`,
            metadata: {
              error: error.message,
              stack: error.stack,
              version_id: data.version_id,
              approved_by: data.approved_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since approved_by is optional
          logger.warn({
            message: `Error checking approved_by employee reference, setting to null: ${error.message}`,
            metadata: {
              version_id: data.version_id,
              approved_by: data.approved_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.approved_by = null;
        }
      }

      // Verify that created_by employee exists if provided
      if (data.created_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.created_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.created_by} not found for PolicyDocumentVersion created_by`,
              metadata: {
                version_id: data.version_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since created_by is optional
            logger.warn({
              message: `Invalid created_by: Employee not found, setting to null`,
              metadata: {
                version_id: data.version_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.created_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking created_by employee reference for PolicyDocumentVersion`,
            metadata: {
              error: error.message,
              stack: error.stack,
              version_id: data.version_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since created_by is optional
          logger.warn({
            message: `Error checking created_by employee reference, setting to null: ${error.message}`,
            metadata: {
              version_id: data.version_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.created_by = null;
        }
      }

      // Verify that updated_by employee exists if provided
      if (data.updated_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.updated_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.updated_by} not found for PolicyDocumentVersion updated_by`,
              metadata: {
                version_id: data.version_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since updated_by is optional
            logger.warn({
              message: `Invalid updated_by: Employee not found, setting to null`,
              metadata: {
                version_id: data.version_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.updated_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking updated_by employee reference for PolicyDocumentVersion`,
            metadata: {
              error: error.message,
              stack: error.stack,
              version_id: data.version_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since updated_by is optional
          logger.warn({
            message: `Error checking updated_by employee reference, setting to null: ${error.message}`,
            metadata: {
              version_id: data.version_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.updated_by = null;
        }
      }

      // Validate status field against PolicyStatus enum
      if (
        data.status &&
        !["active", "inactive", "draft", "archived"].includes(data.status)
      ) {
        logger.error({
          message: `Invalid status value for PolicyDocumentVersion: ${data.status}`,
          metadata: {
            version_id: data.version_id,
            status: data.status,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid status value for PolicyDocumentVersion: ${data.status}. Must be one of: active, inactive, draft, archived`,
          data: null,
        });
      }
    }
    // Special handling for probation-policies model
    else if (objectType === "probation-policies") {
      // First set up the whereCondition properly for the upsert operation
      if (data.policy_id) {
        // Use primary key if available
        whereCondition = { policy_id: data.policy_id };
        logger.info({
          message: `Using primary key for ProbationPolicy upsert`,
          metadata: {
            policy_id: data.policy_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for ProbationPolicy`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier policy_id for ProbationPolicy",
          data: null,
        });
      }

      // Verify that org_id exists as it's a required foreign key
      if (data.org_id) {
        try {
          const organization = await prisma.Organization.findUnique({
            where: { org_id: data.org_id },
          });

          if (!organization) {
            logger.error({
              message: `Organization with ID ${data.org_id} not found for ProbationPolicy`,
              metadata: {
                policy_id: data.policy_id,
                org_id: data.org_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid org_id: Organization not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking organization reference for ProbationPolicy`,
            metadata: {
              error: error.message,
              stack: error.stack,
              policy_id: data.policy_id,
              org_id: data.org_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking organization reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required org_id for ProbationPolicy`,
          metadata: {
            policy_id: data.policy_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required org_id for ProbationPolicy",
          data: null,
        });
      }

      // Check probation_code uniqueness (global unique constraint)
      if (data.probation_code) {
        try {
          const existingPolicy = await prisma.ProbationPolicy.findFirst({
            where: {
              probation_code: data.probation_code,
              NOT: { policy_id: data.policy_id },
            },
          });

          if (existingPolicy) {
            logger.error({
              message: `Unique constraint violation: ProbationPolicy with probation_code ${data.probation_code} already exists`,
              metadata: {
                policy_id: data.policy_id,
                probation_code: data.probation_code,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Unique constraint violation: ProbationPolicy with probation_code ${data.probation_code} already exists`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking unique constraint for ProbationPolicy (probation_code)`,
            metadata: {
              error: error.message,
              stack: error.stack,
              policy_id: data.policy_id,
              probation_code: data.probation_code,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking unique constraint (probation_code): ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required probation_code for ProbationPolicy`,
          metadata: {
            policy_id: data.policy_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required probation_code for ProbationPolicy",
          data: null,
        });
      }

      // Check unique combination of org_id and employment_type_id
      if (data.employment_type_id) {
        // First check if employment type exists
        try {
          const employmentType = await prisma.EmploymentType.findUnique({
            where: { employment_type_id: data.employment_type_id },
          });

          if (!employmentType) {
            logger.error({
              message: `EmploymentType with ID ${data.employment_type_id} not found for ProbationPolicy`,
              metadata: {
                policy_id: data.policy_id,
                employment_type_id: data.employment_type_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid employment_type_id: EmploymentType not found`,
              data: null,
            });
          }

          // Then check unique combination
          const existingPolicy = await prisma.ProbationPolicy.findFirst({
            where: {
              org_id: data.org_id,
              employment_type_id: data.employment_type_id,
              NOT: { policy_id: data.policy_id },
            },
          });

          if (existingPolicy) {
            logger.error({
              message: `Unique constraint violation: ProbationPolicy for this organization and employment type already exists`,
              metadata: {
                policy_id: data.policy_id,
                org_id: data.org_id,
                employment_type_id: data.employment_type_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Unique constraint violation: ProbationPolicy for this organization and employment type already exists`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking employment type reference or unique constraint for ProbationPolicy`,
            metadata: {
              error: error.message,
              stack: error.stack,
              policy_id: data.policy_id,
              org_id: data.org_id,
              employment_type_id: data.employment_type_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking employment type reference or unique constraint: ${error.message}`,
            data: null,
          });
        }
      }

      // Verify that employee_id exists if provided
      if (data.employee_id) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.employee_id },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.employee_id} not found for ProbationPolicy`,
              metadata: {
                policy_id: data.policy_id,
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since employee_id is optional
            // Just log the warning and continue
            logger.warn({
              message: `Invalid employee_id: Employee not found, setting to null`,
              metadata: {
                policy_id: data.policy_id,
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
            data.employee_id = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee reference for ProbationPolicy`,
            metadata: {
              error: error.message,
              stack: error.stack,
              policy_id: data.policy_id,
              employee_id: data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since employee_id is optional
          // Just log the warning and continue
          logger.warn({
            message: `Error checking employee reference, setting to null: ${error.message}`,
            metadata: {
              policy_id: data.policy_id,
              employee_id: data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          data.employee_id = null;
        }
      }

      // Verify that dept_id exists if provided
      if (data.dept_id) {
        try {
          const department = await prisma.Department.findUnique({
            where: { dept_id: data.dept_id },
          });

          if (!department) {
            logger.error({
              message: `Department with ID ${data.dept_id} not found for ProbationPolicy`,
              metadata: {
                policy_id: data.policy_id,
                dept_id: data.dept_id,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since dept_id is optional
            // Just log the warning and continue
            logger.warn({
              message: `Invalid dept_id: Department not found, setting to null`,
              metadata: {
                policy_id: data.policy_id,
                dept_id: data.dept_id,
                timestamp: new Date().toISOString(),
              },
            });
            data.dept_id = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking department reference for ProbationPolicy`,
            metadata: {
              error: error.message,
              stack: error.stack,
              policy_id: data.policy_id,
              dept_id: data.dept_id,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since dept_id is optional
          // Just log the warning and continue
          logger.warn({
            message: `Error checking department reference, setting to null: ${error.message}`,
            metadata: {
              policy_id: data.policy_id,
              dept_id: data.dept_id,
              timestamp: new Date().toISOString(),
            },
          });
          data.dept_id = null;
        }
      }

      // Verify that created_by employee exists if provided
      if (data.created_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.created_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.created_by} not found for ProbationPolicy created_by`,
              metadata: {
                policy_id: data.policy_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since created_by is optional
            // Just log the warning and continue
            logger.warn({
              message: `Invalid created_by: Employee not found, setting to null`,
              metadata: {
                policy_id: data.policy_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.created_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking created_by employee reference for ProbationPolicy`,
            metadata: {
              error: error.message,
              stack: error.stack,
              policy_id: data.policy_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since created_by is optional
          // Just log the warning and continue
          logger.warn({
            message: `Error checking created_by employee reference, setting to null: ${error.message}`,
            metadata: {
              policy_id: data.policy_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.created_by = null;
        }
      }

      // Verify that updated_by employee exists if provided
      if (data.updated_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.updated_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.updated_by} not found for ProbationPolicy updated_by`,
              metadata: {
                policy_id: data.policy_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since updated_by is optional
            // Just log the warning and continue
            logger.warn({
              message: `Invalid updated_by: Employee not found, setting to null`,
              metadata: {
                policy_id: data.policy_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.updated_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking updated_by employee reference for ProbationPolicy`,
            metadata: {
              error: error.message,
              stack: error.stack,
              policy_id: data.policy_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since updated_by is optional
          // Just log the warning and continue
          logger.warn({
            message: `Error checking updated_by employee reference, setting to null: ${error.message}`,
            metadata: {
              policy_id: data.policy_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.updated_by = null;
        }
      }

      // Check required integer fields
      const requiredIntFields = [
        "probation_period_months",
        "min_extension_months",
        "notice_period_days",
        "review_before_days",
      ];
      for (const field of requiredIntFields) {
        if (
          data[field] === undefined ||
          data[field] === null ||
          isNaN(parseInt(data[field]))
        ) {
          logger.error({
            message: `Missing or invalid required integer field ${field} for ProbationPolicy`,
            metadata: {
              policy_id: data.policy_id,
              [field]: data[field],
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Missing or invalid required integer field ${field} for ProbationPolicy`,
            data: null,
          });
        }

        // Convert to number
        data[field] = parseInt(data[field]);
      }

      // Handle optional integer fields
      const optionalIntFields = ["max_extension_months", "max_extensions"];
      for (const field of optionalIntFields) {
        if (data[field] !== undefined && data[field] !== null) {
          if (isNaN(parseInt(data[field]))) {
            logger.error({
              message: `Invalid integer format for ${field} in ProbationPolicy`,
              metadata: {
                policy_id: data.policy_id,
                [field]: data[field],
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid integer format for ${field}`,
              data: null,
            });
          }

          // Convert to number
          data[field] = parseInt(data[field]);
        }
      }

      // Handle boolean fields properly
      const booleanFields = [
        "extension_allowed",
        "auto_confirm",
        "review_required",
      ];
      for (const field of booleanFields) {
        if (data[field] !== undefined) {
          data[field] = Boolean(data[field]);
        }
      }

      // Validate status field against Status enum
      if (data.status && !["active", "inactive"].includes(data.status)) {
        logger.error({
          message: `Invalid status value for ProbationPolicy: ${data.status}`,
          metadata: {
            policy_id: data.policy_id,
            status: data.status,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid status value for ProbationPolicy: ${data.status}. Must be one of: active, inactive`,
          data: null,
        });
      }
    }
    // Special handling for policy-settings model
    else if (objectType === "policy-settings") {
      // First set up the whereCondition properly for the upsert operation
      if (data.setting_id) {
        // Use primary key if available
        whereCondition = { setting_id: data.setting_id };
        logger.info({
          message: `Using primary key for PolicySetting upsert`,
          metadata: {
            setting_id: data.setting_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for PolicySetting`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier setting_id for PolicySetting",
          data: null,
        });
      }

      // Verify that org_id exists as it's a required foreign key
      if (data.org_id) {
        try {
          const organization = await prisma.Organization.findUnique({
            where: { org_id: data.org_id },
          });

          if (!organization) {
            logger.error({
              message: `Organization with ID ${data.org_id} not found for PolicySetting`,
              metadata: {
                setting_id: data.setting_id,
                org_id: data.org_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid org_id: Organization not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking organization reference for PolicySetting`,
            metadata: {
              error: error.message,
              stack: error.stack,
              setting_id: data.setting_id,
              org_id: data.org_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking organization reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required org_id for PolicySetting`,
          metadata: {
            setting_id: data.setting_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required org_id for PolicySetting",
          data: null,
        });
      }

      // Verify that module_id exists as it's a required foreign key
      if (data.module_id) {
        try {
          const policyModule = await prisma.PolicyModule.findUnique({
            where: { module_id: data.module_id },
          });

          if (!policyModule) {
            logger.error({
              message: `PolicyModule with ID ${data.module_id} not found for PolicySetting`,
              metadata: {
                setting_id: data.setting_id,
                module_id: data.module_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid module_id: PolicyModule not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking policy module reference for PolicySetting`,
            metadata: {
              error: error.message,
              stack: error.stack,
              setting_id: data.setting_id,
              module_id: data.module_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking policy module reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required module_id for PolicySetting`,
          metadata: {
            setting_id: data.setting_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required module_id for PolicySetting",
          data: null,
        });
      }

      // Check for unique constraint violation ([module_id, setting_key])
      if (data.setting_key) {
        try {
          const existingSetting = await prisma.PolicySetting.findFirst({
            where: {
              module_id: data.module_id,
              setting_key: data.setting_key,
              NOT: { setting_id: data.setting_id },
            },
          });

          if (existingSetting) {
            logger.error({
              message: `Unique constraint violation: PolicySetting with setting_key ${data.setting_key} already exists for this module`,
              metadata: {
                setting_id: data.setting_id,
                module_id: data.module_id,
                setting_key: data.setting_key,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Unique constraint violation: PolicySetting with setting_key ${data.setting_key} already exists for this module`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking unique constraint for PolicySetting`,
            metadata: {
              error: error.message,
              stack: error.stack,
              setting_id: data.setting_id,
              module_id: data.module_id,
              setting_key: data.setting_key,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking unique constraint: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required setting_key for PolicySetting`,
          metadata: {
            setting_id: data.setting_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required setting_key for PolicySetting",
          data: null,
        });
      }

      // Verify that created_by employee exists if provided
      if (data.created_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.created_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.created_by} not found for PolicySetting created_by`,
              metadata: {
                setting_id: data.setting_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since created_by is optional
            // Just log the warning and continue
            logger.warn({
              message: `Invalid created_by: Employee not found, setting to null`,
              metadata: {
                setting_id: data.setting_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.created_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking created_by employee reference for PolicySetting`,
            metadata: {
              error: error.message,
              stack: error.stack,
              setting_id: data.setting_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since created_by is optional
          // Just log the warning and continue
          logger.warn({
            message: `Error checking created_by employee reference, setting to null: ${error.message}`,
            metadata: {
              setting_id: data.setting_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.created_by = null;
        }
      }

      // Verify that updated_by employee exists if provided
      if (data.updated_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.updated_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.updated_by} not found for PolicySetting updated_by`,
              metadata: {
                setting_id: data.setting_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since updated_by is optional
            // Just log the warning and continue
            logger.warn({
              message: `Invalid updated_by: Employee not found, setting to null`,
              metadata: {
                setting_id: data.setting_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.updated_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking updated_by employee reference for PolicySetting`,
            metadata: {
              error: error.message,
              stack: error.stack,
              setting_id: data.setting_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since updated_by is optional
          // Just log the warning and continue
          logger.warn({
            message: `Error checking updated_by employee reference, setting to null: ${error.message}`,
            metadata: {
              setting_id: data.setting_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.updated_by = null;
        }
      }

      // Check required fields
      const requiredFields = [
        "setting_name",
        "setting_key",
        "setting_value",
        "setting_type",
      ];
      for (const field of requiredFields) {
        if (field === "setting_value") {
          // For setting_value, check if it exists and is a valid JSON object
          if (!data[field] || typeof data[field] !== "object") {
            logger.error({
              message: `Invalid or missing ${field} for PolicySetting`,
              metadata: {
                setting_id: data.setting_id,
                [field]: data[field],
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid or missing ${field} for PolicySetting: must be a valid JSON object`,
              data: null,
            });
          }
        } else if (!data[field]) {
          logger.error({
            message: `Missing required field ${field} for PolicySetting`,
            metadata: {
              setting_id: data.setting_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Missing required field ${field} for PolicySetting`,
            data: null,
          });
        }
      }

      // Validate setting_type field against SettingType enum
      const validSettingTypes = [
        "number",
        "string",
        "boolean",
        "date",
        "object",
        "array",
      ];
      if (data.setting_type && !validSettingTypes.includes(data.setting_type)) {
        logger.error({
          message: `Invalid setting_type value for PolicySetting: ${data.setting_type}`,
          metadata: {
            setting_id: data.setting_id,
            setting_type: data.setting_type,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid setting_type value for PolicySetting: ${data.setting_type}. Must be one of: ${validSettingTypes.join(", ")}`,
          data: null,
        });
      }

      // Handle boolean fields properly
      const booleanFields = ["is_encrypted", "is_configurable"];
      for (const field of booleanFields) {
        if (data[field] !== undefined) {
          data[field] = Boolean(data[field]);
        }
      }

      // Handle JSON fields
      const jsonFields = ["setting_value", "validation_rules", "default_value"];
      for (const field of jsonFields) {
        if (data[field] !== undefined && data[field] !== null) {
          // If it's already an object, make sure it's properly formatted for Prisma
          if (typeof data[field] === "object") {
            // We don't need to do anything here as Prisma can handle JSON objects directly
          } else if (typeof data[field] === "string") {
            // If it's a string, try to parse it as JSON
            try {
              data[field] = JSON.parse(data[field]);
            } catch (error) {
              logger.error({
                message: `Invalid JSON format for ${field} in PolicySetting`,
                metadata: {
                  error: error.message,
                  [field]: data[field],
                  setting_id: data.setting_id,
                  timestamp: new Date().toISOString(),
                },
              });
              return res.status(400).json({
                status: "error",
                message: `Invalid JSON format for ${field}: ${error.message}`,
                data: null,
              });
            }
          }
        }
      }

      // Validate status field against Status enum
      if (data.status && !["active", "inactive"].includes(data.status)) {
        logger.error({
          message: `Invalid status value for PolicySetting: ${data.status}`,
          metadata: {
            setting_id: data.setting_id,
            status: data.status,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid status value for PolicySetting: ${data.status}. Must be one of: active, inactive`,
          data: null,
        });
      }
    }
    // Special handling for policy-modules model
    else if (objectType === "policy-modules") {
      // First set up the whereCondition properly for the upsert operation
      if (data.module_id) {
        // Use primary key if available
        whereCondition = { module_id: data.module_id };
        logger.info({
          message: `Using primary key for PolicyModule upsert`,
          metadata: {
            module_id: data.module_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for PolicyModule`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier module_id for PolicyModule",
          data: null,
        });
      }

      // Verify that org_id exists as it's a required foreign key
      if (data.org_id) {
        try {
          const organization = await prisma.Organization.findUnique({
            where: { org_id: data.org_id },
          });

          if (!organization) {
            logger.error({
              message: `Organization with ID ${data.org_id} not found for PolicyModule`,
              metadata: {
                module_id: data.module_id,
                org_id: data.org_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid org_id: Organization not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking organization reference for PolicyModule`,
            metadata: {
              error: error.message,
              stack: error.stack,
              module_id: data.module_id,
              org_id: data.org_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking organization reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required org_id for PolicyModule`,
          metadata: {
            module_id: data.module_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required org_id for PolicyModule",
          data: null,
        });
      }

      // Check for unique constraint violation ([org_id, module_code])
      if (data.module_code) {
        try {
          const existingModule = await prisma.PolicyModule.findFirst({
            where: {
              org_id: data.org_id,
              module_code: data.module_code,
              NOT: { module_id: data.module_id },
            },
          });

          if (existingModule) {
            logger.error({
              message: `Unique constraint violation: PolicyModule with module_code ${data.module_code} already exists for this organization`,
              metadata: {
                module_id: data.module_id,
                org_id: data.org_id,
                module_code: data.module_code,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Unique constraint violation: PolicyModule with module_code ${data.module_code} already exists for this organization`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking unique constraint for PolicyModule`,
            metadata: {
              error: error.message,
              stack: error.stack,
              module_id: data.module_id,
              org_id: data.org_id,
              module_code: data.module_code,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking unique constraint: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required module_code for PolicyModule`,
          metadata: {
            module_id: data.module_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required module_code for PolicyModule",
          data: null,
        });
      }

      // Verify that created_by employee exists if provided
      if (data.created_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.created_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.created_by} not found for PolicyModule created_by`,
              metadata: {
                module_id: data.module_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since created_by is optional
            // Just log the warning and continue
            logger.warn({
              message: `Invalid created_by: Employee not found, setting to null`,
              metadata: {
                module_id: data.module_id,
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.created_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking created_by employee reference for PolicyModule`,
            metadata: {
              error: error.message,
              stack: error.stack,
              module_id: data.module_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since created_by is optional
          // Just log the warning and continue
          logger.warn({
            message: `Error checking created_by employee reference, setting to null: ${error.message}`,
            metadata: {
              module_id: data.module_id,
              created_by: data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.created_by = null;
        }
      }

      // Verify that updated_by employee exists if provided
      if (data.updated_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.updated_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.updated_by} not found for PolicyModule updated_by`,
              metadata: {
                module_id: data.module_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            // Not returning error since updated_by is optional
            // Just log the warning and continue
            logger.warn({
              message: `Invalid updated_by: Employee not found, setting to null`,
              metadata: {
                module_id: data.module_id,
                updated_by: data.updated_by,
                timestamp: new Date().toISOString(),
              },
            });
            data.updated_by = null;
          }
        } catch (error) {
          logger.error({
            message: `Error checking updated_by employee reference for PolicyModule`,
            metadata: {
              error: error.message,
              stack: error.stack,
              module_id: data.module_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          // Not returning error since updated_by is optional
          // Just log the warning and continue
          logger.warn({
            message: `Error checking updated_by employee reference, setting to null: ${error.message}`,
            metadata: {
              module_id: data.module_id,
              updated_by: data.updated_by,
              timestamp: new Date().toISOString(),
            },
          });
          data.updated_by = null;
        }
      }

      // Check required fields
      const requiredFields = ["module_name", "module_code"];
      for (const field of requiredFields) {
        if (!data[field]) {
          logger.error({
            message: `Missing required field ${field} for PolicyModule`,
            metadata: {
              module_id: data.module_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Missing required field ${field} for PolicyModule`,
            data: null,
          });
        }
      }

      // Format required date fields properly
      if (data.effective_from) {
        try {
          data.effective_from = new Date(data.effective_from);
          if (isNaN(data.effective_from.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid effective_from date format for PolicyModule`,
            metadata: {
              effective_from: data.effective_from,
              module_id: data.module_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Invalid effective_from date format: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required effective_from date for PolicyModule`,
          metadata: {
            module_id: data.module_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Missing required effective_from date for PolicyModule`,
          data: null,
        });
      }

      // Format optional date fields if present
      if (data.effective_to) {
        try {
          data.effective_to = new Date(data.effective_to);
          if (isNaN(data.effective_to.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid effective_to date format for PolicyModule`,
            metadata: {
              effective_to: data.effective_to,
              module_id: data.module_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Invalid effective_to date format: ${error.message}`,
            data: null,
          });
        }
      }

      // Handle boolean fields properly
      if (data.is_mandatory !== undefined) {
        data.is_mandatory = Boolean(data.is_mandatory);
      }

      // Validate status field against PolicyStatus enum
      if (
        data.status &&
        !["active", "inactive", "draft", "archived"].includes(data.status)
      ) {
        logger.error({
          message: `Invalid status value for PolicyModule: ${data.status}`,
          metadata: {
            module_id: data.module_id,
            status: data.status,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid status value for PolicyModule: ${data.status}. Must be one of: active, inactive, draft, archived`,
          data: null,
        });
      }

      // Validate module_category field against PolicyCategory enum
      const validCategories = [
        "probation",
        "leave",
        "attendance",
        "benefits",
        "payroll",
        "performance",
        "expense",
        "code_of_conduct",
        "other",
      ];
      if (
        data.module_category &&
        !validCategories.includes(data.module_category)
      ) {
        logger.error({
          message: `Invalid module_category value for PolicyModule: ${data.module_category}`,
          metadata: {
            module_id: data.module_id,
            module_category: data.module_category,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid module_category value for PolicyModule: ${data.module_category}. Must be one of: ${validCategories.join(", ")}`,
          data: null,
        });
      }
    }
    // Special handling for payroll-runs model
    else if (objectType === "payroll-runs") {
      // First set up the whereCondition properly for the upsert operation
      if (data.run_id) {
        // Use primary key if available
        whereCondition = { run_id: data.run_id };
        logger.info({
          message: `Using primary key for PayrollRun upsert`,
          metadata: {
            run_id: data.run_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for PayrollRun`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required unique identifier run_id for PayrollRun",
          data: null,
        });
      }

      // Verify that org_id exists as it's a required foreign key
      if (data.org_id) {
        try {
          const organization = await prisma.Organization.findUnique({
            where: { org_id: data.org_id },
          });

          if (!organization) {
            logger.error({
              message: `Organization with ID ${data.org_id} not found for PayrollRun`,
              metadata: {
                run_id: data.run_id,
                org_id: data.org_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid org_id: Organization not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking organization reference for PayrollRun`,
            metadata: {
              error: error.message,
              stack: error.stack,
              run_id: data.run_id,
              org_id: data.org_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking organization reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required org_id for PayrollRun`,
          metadata: {
            run_id: data.run_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required org_id for PayrollRun",
          data: null,
        });
      }

      // Verify that cycle_id exists as it's a required foreign key
      if (data.cycle_id) {
        try {
          let payrollCycle = await prisma.PayrollCycle.findUnique({
            where: { cycle_id: data.cycle_id },
          });

          // If payroll cycle not found, check if we have enough information to create it
          if (!payrollCycle) {
            if (data.cycle_name && data.org_id) {
              logger.info({
                message: `Attempting to create missing payroll cycle with ID ${data.cycle_id}`,
                metadata: {
                  cycle_id: data.cycle_id,
                  cycle_name: data.cycle_name,
                  org_id: data.org_id,
                  timestamp: new Date().toISOString(),
                },
              });
              
              try {
                // Determine cycle_type and frequency defaults if not provided
                const cycleType = data.cycle_type || 'regular';
                const frequency = data.frequency || 'monthly';
                
                // Create new payroll cycle record with the information we have
                payrollCycle = await prisma.PayrollCycle.create({
                  data: {
                    cycle_id: data.cycle_id,
                    cycle_name: data.cycle_name,
                    org_id: data.org_id,
                    cycle_type: cycleType,
                    frequency: frequency,
                    start_date: data.start_date || new Date(),
                    end_date: data.end_date || null,
                    status: 'active',
                    created_at: new Date(),
                    updated_at: new Date(),
                  },
                });
                
                logger.info({
                  message: `Successfully created missing payroll cycle with ID ${data.cycle_id}`,
                  metadata: {
                    cycle_id: data.cycle_id,
                    timestamp: new Date().toISOString(),
                  },
                });
              } catch (createError) {
                logger.error({
                  message: `Failed to create missing payroll cycle with ID ${data.cycle_id}`,
                  metadata: {
                    error: createError.message,
                    stack: createError.stack,
                    cycle_id: data.cycle_id,
                    timestamp: new Date().toISOString(),
                  },
                });
                
                return res.status(400).json({
                  status: "error",
                  message: `Could not create missing payroll cycle: ${createError.message}`,
                  data: null,
                });
              }
            } else {
              logger.warn({
                message: `PayrollCycle with ID ${data.cycle_id} not found for PayrollRun and couldn't be created due to missing information. Deferring processing.`,
                metadata: {
                  run_id: data.run_id,
                  cycle_id: data.cycle_id,
                  timestamp: new Date().toISOString(),
                },
              });
              return res.status(202).json({
                status: "deferred",
                message: `PayrollCycle with ID ${data.cycle_id} not found. This record will be processed later.`,
                data: null,
              });
            }
          }
        } catch (error) {
          logger.error({
            message: `Error checking payroll cycle reference for PayrollRun`,
            metadata: {
              error: error.message,
              stack: error.stack,
              run_id: data.run_id,
              cycle_id: data.cycle_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking payroll cycle reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required cycle_id for PayrollRun`,
          metadata: {
            run_id: data.run_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required cycle_id for PayrollRun",
          data: null,
        });
      }

      // Verify that processed_by employee exists if provided
      if (data.processed_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.processed_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.processed_by} not found for PayrollRun processed_by`,
              metadata: {
                run_id: data.run_id,
                processed_by: data.processed_by,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid processed_by: Employee not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking processed_by employee reference for PayrollRun`,
            metadata: {
              error: error.message,
              stack: error.stack,
              run_id: data.run_id,
              processed_by: data.processed_by,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking processed_by employee reference: ${error.message}`,
            data: null,
          });
        }
      }

      // Verify that approved_by employee exists if provided
      if (data.approved_by) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.approved_by },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.approved_by} not found for PayrollRun approved_by`,
              metadata: {
                run_id: data.run_id,
                approved_by: data.approved_by,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid approved_by: Employee not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking approved_by employee reference for PayrollRun`,
            metadata: {
              error: error.message,
              stack: error.stack,
              run_id: data.run_id,
              approved_by: data.approved_by,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking approved_by employee reference: ${error.message}`,
            data: null,
          });
        }
      }

      // Format required date fields properly
      const requiredDateFields = ["run_date", "start_date", "end_date"];
      for (const field of requiredDateFields) {
        if (data[field]) {
          try {
            data[field] = new Date(data[field]);
            if (isNaN(data[field].getTime())) {
              throw new Error("Invalid date format");
            }
          } catch (error) {
            logger.error({
              message: `Invalid ${field} date format for PayrollRun`,
              metadata: {
                [field]: data[field],
                run_id: data.run_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid ${field} date format: ${error.message}`,
              data: null,
            });
          }
        } else {
          logger.error({
            message: `Missing required ${field} date for PayrollRun`,
            metadata: {
              run_id: data.run_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Missing required ${field} date for PayrollRun`,
            data: null,
          });
        }
      }

      // Ensure decimal values are properly formatted
      const decimalFields = [
        "total_gross",
        "total_deductions",
        "total_net_pay",
      ];
      for (const field of decimalFields) {
        if (data[field] !== undefined && data[field] !== null) {
          try {
            // Convert to Decimal-compatible format (string representation)
            data[field] = data[field].toString();
          } catch (error) {
            logger.error({
              message: `Invalid decimal format for ${field} in PayrollRun`,
              metadata: {
                [field]: data[field],
                run_id: data.run_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid decimal format for ${field}: ${error.message}`,
              data: null,
            });
          }
        }
      }
    }
    // Special handling for employee-salaries model
    else if (objectType === "employee-salaries") {
      // First set up the whereCondition properly for the upsert operation
      if (data.salary_id) {
        // Use primary key if available
        whereCondition = { salary_id: data.salary_id };
        logger.info({
          message: `Using primary key for EmployeeSalary upsert`,
          metadata: {
            salary_id: data.salary_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for EmployeeSalary`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier salary_id for EmployeeSalary",
          data: null,
        });
      }

      // Verify that employee_id exists as it's a required foreign key
      if (data.employee_id) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.employee_id },
          });

          if (!employee) {
            logger.warn({
              message: `Employee with ID ${data.employee_id} not found for EmployeeSalary. Deferring processing.`,
              metadata: {
                salary_id: data.salary_id,
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(202).json({
              status: "deferred",
              message: `Employee with ID ${data.employee_id} not found. This record will be processed later.`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee reference for EmployeeSalary`,
            metadata: {
              error: error.message,
              stack: error.stack,
              salary_id: data.salary_id,
              employee_id: data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking employee reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required employee_id for EmployeeSalary`,
          metadata: {
            salary_id: data.salary_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required employee_id for EmployeeSalary",
          data: null,
        });
      }

      // Verify that structure_id exists as it's a required foreign key
      if (data.structure_id) {
        try {
          let salaryStructure = await prisma.SalaryStructure.findUnique({
            where: { structure_id: data.structure_id },
          });

          // If salary structure not found, check if we have enough information to create it
          if (!salaryStructure) {
            // Check if we have at least the structure name
            if (data.structure_name) {
              logger.info({
                message: `Attempting to create missing salary structure with ID ${data.structure_id}`,
                metadata: {
                  structure_id: data.structure_id,
                  structure_name: data.structure_name,
                  timestamp: new Date().toISOString(),
                },
              });
              
              try {
                // Create new salary structure record with the information we have
                salaryStructure = await prisma.SalaryStructure.create({
                  data: {
                    structure_id: data.structure_id,
                    structure_name: data.structure_name,
                    org_id: data.org_id || null,
                    status: 'active',
                    created_at: new Date(),
                    updated_at: new Date(),
                  },
                });
                
                logger.info({
                  message: `Successfully created missing salary structure with ID ${data.structure_id}`,
                  metadata: {
                    structure_id: data.structure_id,
                    timestamp: new Date().toISOString(),
                  },
                });
              } catch (createError) {
                logger.error({
                  message: `Failed to create missing salary structure with ID ${data.structure_id}`,
                  metadata: {
                    error: createError.message,
                    stack: createError.stack,
                    structure_id: data.structure_id,
                    timestamp: new Date().toISOString(),
                  },
                });
                
                // Continue with a warning since we attempted but couldn't create the salary structure
                return res.status(400).json({
                  status: "error",
                  message: `Could not create missing salary structure: ${createError.message}`,
                  data: null,
                });
              }
            } else {
              logger.warn({
                message: `SalaryStructure with ID ${data.structure_id} not found for EmployeeSalary and couldn't be created due to missing information. Deferring processing.`,
                metadata: {
                  salary_id: data.salary_id,
                  structure_id: data.structure_id,
                  timestamp: new Date().toISOString(),
                },
              });
              return res.status(202).json({
                status: "deferred",
                message: `SalaryStructure with ID ${data.structure_id} not found. This record will be processed later.`,
                data: null,
              });
            }
          }
        } catch (error) {
          logger.error({
            message: `Error checking salary structure reference for EmployeeSalary`,
            metadata: {
              error: error.message,
              stack: error.stack,
              salary_id: data.salary_id,
              structure_id: data.structure_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking salary structure reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required structure_id for EmployeeSalary`,
          metadata: {
            salary_id: data.salary_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required structure_id for EmployeeSalary",
          data: null,
        });
      }

      // Format required effective_from date field properly
      if (data.effective_from) {
        try {
          data.effective_from = new Date(data.effective_from);
          if (isNaN(data.effective_from.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid effective_from date format for EmployeeSalary`,
            metadata: {
              effective_from: data.effective_from,
              salary_id: data.salary_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Invalid effective_from date format: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required effective_from date for EmployeeSalary`,
          metadata: {
            salary_id: data.salary_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required effective_from date for EmployeeSalary",
          data: null,
        });
      }

      // Format optional effective_to date field if present
      if (data.effective_to) {
        try {
          data.effective_to = new Date(data.effective_to);
          if (isNaN(data.effective_to.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid effective_to date format for EmployeeSalary`,
            metadata: {
              effective_to: data.effective_to,
              salary_id: data.salary_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Invalid effective_to date format: ${error.message}`,
            data: null,
          });
        }
      }

      // Ensure decimal values are properly formatted
      const decimalFields = [
        "annual_ctc",
        "monthly_ctc",
        "basic_percent",
        "hra_percent",
      ];
      for (const field of decimalFields) {
        if (data[field] !== undefined && data[field] !== null) {
          try {
            // Convert to Decimal-compatible format (string representation)
            data[field] = data[field].toString();
          } catch (error) {
            logger.error({
              message: `Invalid decimal format for ${field} in EmployeeSalary`,
              metadata: {
                [field]: data[field],
                salary_id: data.salary_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid decimal format for ${field}: ${error.message}`,
              data: null,
            });
          }
        } else if (
          ["annual_ctc", "monthly_ctc", "basic_percent"].includes(field) &&
          (data[field] === undefined || data[field] === null)
        ) {
          // These fields are required according to the schema
          logger.error({
            message: `Missing required ${field} for EmployeeSalary`,
            metadata: {
              salary_id: data.salary_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Missing required ${field} for EmployeeSalary`,
            data: null,
          });
        }
      }
    }
    // Special handling for employee-financial-details model
    else if (objectType === "employee-financial-details") {
      // First set up the whereCondition properly for the upsert operation
      if (data.empl_financial_id) {
        // Use primary key if available
        whereCondition = { empl_financial_id: data.empl_financial_id };
        logger.info({
          message: `Using primary key for EmployeeFinancialDetail upsert`,
          metadata: {
            empl_financial_id: data.empl_financial_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else if (data.employee_id) {
        // Use employee_id as it has a unique constraint
        whereCondition = { employee_id: data.employee_id };
        logger.info({
          message: `Using employee_id for EmployeeFinancialDetail upsert`,
          metadata: {
            employee_id: data.employee_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for EmployeeFinancialDetail`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier for EmployeeFinancialDetail: need either empl_financial_id or employee_id",
          data: null,
        });
      }

      // Verify that employee_id exists as it's a required foreign key
      if (data.employee_id) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.employee_id },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.employee_id} not found for EmployeeFinancialDetail`,
              metadata: {
                empl_financial_id: data.empl_financial_id,
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid employee_id: Employee not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee reference for EmployeeFinancialDetail`,
            metadata: {
              error: error.message,
              stack: error.stack,
              empl_financial_id: data.empl_financial_id,
              employee_id: data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking employee reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required employee_id for EmployeeFinancialDetail`,
          metadata: {
            empl_financial_id: data.empl_financial_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required employee_id for EmployeeFinancialDetail",
          data: null,
        });
      }

      // Verify that employee_bank_id exists if provided
      if (data.employee_bank_id) {
        try {
          const employeeBank = await prisma.EmployeeBankDetail.findUnique({
            where: { employee_bank_id: data.employee_bank_id },
          });

          if (!employeeBank) {
            logger.error({
              message: `EmployeeBankDetail with ID ${data.employee_bank_id} not found for EmployeeFinancialDetail`,
              metadata: {
                empl_financial_id: data.empl_financial_id,
                employee_bank_id: data.employee_bank_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid employee_bank_id: EmployeeBankDetail not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee bank reference for EmployeeFinancialDetail`,
            metadata: {
              error: error.message,
              stack: error.stack,
              empl_financial_id: data.empl_financial_id,
              employee_bank_id: data.employee_bank_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking employee bank reference: ${error.message}`,
            data: null,
          });
        }
      }

      // Format date fields properly if present
      if (data.pf_joining_date) {
        try {
          data.pf_joining_date = new Date(data.pf_joining_date);
          if (isNaN(data.pf_joining_date.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid pf_joining_date format for EmployeeFinancialDetail`,
            metadata: {
              pf_joining_date: data.pf_joining_date,
              empl_financial_id: data.empl_financial_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Invalid pf_joining_date format: ${error.message}`,
            data: null,
          });
        }
      }

      if (data.dob_in_aadhar) {
        try {
          data.dob_in_aadhar = new Date(data.dob_in_aadhar);
          if (isNaN(data.dob_in_aadhar.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid dob_in_aadhar format for EmployeeFinancialDetail`,
            metadata: {
              dob_in_aadhar: data.dob_in_aadhar,
              empl_financial_id: data.empl_financial_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Invalid dob_in_aadhar format: ${error.message}`,
            data: null,
          });
        }
      }

      if (data.dob_in_pan) {
        try {
          data.dob_in_pan = new Date(data.dob_in_pan);
          if (isNaN(data.dob_in_pan.getTime())) {
            throw new Error("Invalid date format");
          }
        } catch (error) {
          logger.error({
            message: `Invalid dob_in_pan format for EmployeeFinancialDetail`,
            metadata: {
              dob_in_pan: data.dob_in_pan,
              empl_financial_id: data.empl_financial_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(400).json({
            status: "error",
            message: `Invalid dob_in_pan format: ${error.message}`,
            data: null,
          });
        }
      }
    }
    // Special handling for employee-bank-details model
    else if (objectType === "employee-bank-details") {
      // First set up the whereCondition properly for the upsert operation
      if (data.employee_bank_id) {
        // Use primary key if available
        whereCondition = { employee_bank_id: data.employee_bank_id };
        logger.info({
          message: `Using primary key for EmployeeBankDetail upsert`,
          metadata: {
            employee_bank_id: data.employee_bank_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else if (data.account_number) {
        // Use account_number as it has a unique constraint
        whereCondition = { account_number: data.account_number };
        logger.info({
          message: `Using account_number for EmployeeBankDetail upsert`,
          metadata: {
            account_number: data.account_number,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for EmployeeBankDetail`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier for EmployeeBankDetail: need either employee_bank_id or account_number",
          data: null,
        });
      }

      // Verify that employee_id exists as it's a required foreign key
      if (data.employee_id) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.employee_id },
          });

          if (!employee) {
            logger.warn({
              message: `Employee with ID ${data.employee_id} not found for EmployeeBankDetail. Deferring processing.`,
              metadata: {
                employee_bank_id: data.employee_bank_id,
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(202).json({
              status: "deferred",
              message: `Employee with ID ${data.employee_id} not found. This record will be processed later.`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee reference for EmployeeBankDetail`,
            metadata: {
              error: error.message,
              stack: error.stack,
              employee_bank_id: data.employee_bank_id,
              employee_id: data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking employee reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required employee_id for EmployeeBankDetail`,
          metadata: {
            employee_bank_id: data.employee_bank_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required employee_id for EmployeeBankDetail",
          data: null,
        });
      }

      // Verify that bank_id exists as it's a required foreign key
      if (data.bank_id) {
        try {
          let bank = await prisma.BankMaster.findUnique({
            where: { bank_id: data.bank_id },
          });

          // If bank not found, check if we have enough information to create it
          if (!bank) {
            // Check if we have at least the bank name
            if (data.bank_name) {
              logger.info({
                message: `Attempting to create missing bank with ID ${data.bank_id}`,
                metadata: {
                  bank_id: data.bank_id,
                  bank_name: data.bank_name,
                  timestamp: new Date().toISOString(),
                },
              });
              
              try {
                // Create new bank record with the information we have
                bank = await prisma.BankMaster.create({
                  data: {
                    bank_id: data.bank_id,
                    bank_name: data.bank_name,
                    status: 'active',
                    created_at: new Date(),
                    updated_at: new Date(),
                  },
                });
                
                logger.info({
                  message: `Successfully created missing bank with ID ${data.bank_id}`,
                  metadata: {
                    bank_id: data.bank_id,
                    timestamp: new Date().toISOString(),
                  },
                });
              } catch (createError) {
                logger.error({
                  message: `Failed to create missing bank with ID ${data.bank_id}`,
                  metadata: {
                    error: createError.message,
                    stack: createError.stack,
                    bank_id: data.bank_id,
                    timestamp: new Date().toISOString(),
                  },
                });
                
                // Continue with a warning since we attempted but couldn't create the bank
                return res.status(400).json({
                  status: "error",
                  message: `Could not create missing bank: ${createError.message}`,
                  data: null,
                });
              }
            } else {
              logger.error({
                message: `BankMaster with ID ${data.bank_id} not found for EmployeeBankDetail and couldn't be created due to missing information`,
                metadata: {
                  employee_bank_id: data.employee_bank_id,
                  bank_id: data.bank_id,
                  timestamp: new Date().toISOString(),
                },
              });
              return res.status(400).json({
                status: "error",
                message: `Invalid bank_id: BankMaster not found and couldn't be created due to missing information`,
                data: null,
              });
            }
          }
        } catch (error) {
          logger.error({
            message: `Error checking bank reference for EmployeeBankDetail`,
            metadata: {
              error: error.message,
              stack: error.stack,
              employee_bank_id: data.employee_bank_id,
              bank_id: data.bank_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking bank reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required bank_id for EmployeeBankDetail`,
          metadata: {
            employee_bank_id: data.employee_bank_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required bank_id for EmployeeBankDetail",
          data: null,
        });
      }
    }
    // Special handling for employee-personal-details model
    else if (objectType === "employee-personal-details") {
      // First set up the whereCondition properly for the upsert operation
      if (data.empl_personal_det_id) {
        // Use primary key if available
        whereCondition = { empl_personal_det_id: data.empl_personal_det_id };
        logger.info({
          message: `Using primary key for EmployeePersonalDetail upsert`,
          metadata: {
            empl_personal_det_id: data.empl_personal_det_id,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        logger.error({
          message: `Cannot determine unique identifier for EmployeePersonalDetail`,
          metadata: {
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message:
            "Missing required unique identifier for EmployeePersonalDetail: need empl_personal_det_id",
          data: null,
        });
      }

      // Verify that employee_id exists as it's a required foreign key
      if (data.employee_id) {
        try {
          const employee = await prisma.Employee.findUnique({
            where: { employee_id: data.employee_id },
          });

          if (!employee) {
            logger.error({
              message: `Employee with ID ${data.employee_id} not found for EmployeePersonalDetail`,
              metadata: {
                empl_personal_det_id: data.empl_personal_det_id,
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
            return res.status(400).json({
              status: "error",
              message: `Invalid employee_id: Employee not found`,
              data: null,
            });
          }
        } catch (error) {
          logger.error({
            message: `Error checking employee reference for EmployeePersonalDetail`,
            metadata: {
              error: error.message,
              stack: error.stack,
              empl_personal_det_id: data.empl_personal_det_id,
              employee_id: data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          return res.status(500).json({
            status: "error",
            message: `Error checking employee reference: ${error.message}`,
            data: null,
          });
        }
      } else {
        logger.error({
          message: `Missing required employee_id for EmployeePersonalDetail`,
          metadata: {
            empl_personal_det_id: data.empl_personal_det_id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: "Missing required employee_id for EmployeePersonalDetail",
          data: null,
        });
      }

      // Validate marriage_date format if present
      if (data.marriage_date && typeof data.marriage_date === "string") {
        try {
          const parsedDate = new Date(data.marriage_date);
          if (isNaN(parsedDate.getTime())) {
            logger.warn({
              message: `Invalid marriage_date format for EmployeePersonalDetail, setting to null`,
              metadata: {
                empl_personal_det_id: data.empl_personal_det_id,
                marriage_date: data.marriage_date,
                timestamp: new Date().toISOString(),
              },
            });
            data.marriage_date = null;
          }
        } catch (error) {
          logger.warn({
            message: `Error parsing marriage_date for EmployeePersonalDetail, setting to null`,
            metadata: {
              error: error.message,
              empl_personal_det_id: data.empl_personal_det_id,
              marriage_date: data.marriage_date,
              timestamp: new Date().toISOString(),
            },
          });
          data.marriage_date = null;
        }
      }
    }
    // Special handling for OrganizationLocation model
    else if (objectType === "organization-locations") {
      // Handle the case where org_id and location_name are provided but location_id is missing
      if (!data.location_id && data.org_id && data.location_name) {
        logger.info({
          message: `Using unique_org_location_name constraint for OrganizationLocation upsert`,
          metadata: {
            org_id: data.org_id,
            location_name: data.location_name,
            timestamp: new Date().toISOString(),
          },
        });

        // Use the unique constraint for org_id and location_name
        whereCondition = {
          unique_org_location_name: {
            organizationId: data.org_id,
            location_name: data.location_name,
          },
        };
      }
      // Handle the case where org_id and location_code are provided but location_id is missing
      else if (!data.location_id && data.org_id && data.location_code) {
        logger.info({
          message: `Using unique_location_code_org constraint for OrganizationLocation upsert`,
          metadata: {
            org_id: data.org_id,
            location_code: data.location_code,
            timestamp: new Date().toISOString(),
          },
        });

        // Use the unique constraint for org_id and location_code
        whereCondition = {
          unique_location_code_org: {
            organizationId: data.org_id,
            location_code: data.location_code,
          },
        };
      } else {
        // Standard case - use primary key
        if (!data[primaryKeyField]) {
          logger.warn({
            message: `Primary key value missing for ${objectType}`,
            metadata: {
              primaryKeyField,
              data: JSON.stringify(data),
              timestamp: new Date().toISOString(),
            },
          });
        }
        whereCondition[primaryKeyField] = data[primaryKeyField];
      }
    } else {
      // Standard case - use primary key
      if (!data[primaryKeyField]) {
        logger.warn({
          message: `Primary key value missing for ${objectType}`,
          metadata: {
            primaryKeyField,
            data: JSON.stringify(data),
            timestamp: new Date().toISOString(),
          },
        });
      }
      whereCondition[primaryKeyField] = data[primaryKeyField];
    }

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

/**
 * Get object by ID
 * This endpoint retrieves a specific entity by its ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getObjectById = catchAsync(async (req, res, next) => {
  const { objectType, id } = req.params;

  logger.info({
    message: `Retrieving ${objectType} with ID: ${id}`,
    metadata: {
      objectType,
      id,
      timestamp: new Date().toISOString(),
    },
  });

  try {
    // Convert objectType from kebab-case (like organization-locations) to PascalCase for Prisma model name
    const modelName = objectType
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");

    // Singular model name (removing 's' at the end if present)
    const singularModelName = modelName.endsWith("s")
      ? modelName.slice(0, -1)
      : modelName;

    // Get primary key field based on object type
    let primaryKeyField;
    switch (singularModelName) {
      case "organization":
        primaryKeyField = "org_id";
        break;
      case "employee":
        primaryKeyField = "employee_id";
        break;
      case "department":
        primaryKeyField = "dept_id";
        break;
      case "OrganizationLocation":
        primaryKeyField = "location_id";
        break;
      case "employmentType":
        primaryKeyField = "employment_type_id";
        break;
      case "jobTitle":
        primaryKeyField = "job_title_id";
        break;
      case "bankDetail":
        primaryKeyField = "bank_detail_id";
        break;
      case "document":
        primaryKeyField = "document_id";
        break;
      case "contact":
        primaryKeyField = "contact_id";
        break;
      case "qualification":
        primaryKeyField = "qualification_id";
        break;
      case "currentPosition":
        primaryKeyField = "position_id";
        break;
      case "previousEmployment":
        primaryKeyField = "previous_employment_id";
        break;
      case "employeeSalary":
        primaryKeyField = "employee_salary_id";
        break;
      case "salaryStructure":
        primaryKeyField = "structure_id";
        break;
      case "salaryStructureComponent":
        primaryKeyField = "component_id";
        break;
      case "policyModule":
        primaryKeyField = "module_id";
        break;
      case "policySetting":
        primaryKeyField = "setting_id";
        break;
      case "payrollCycle":
        primaryKeyField = "cycle_id";
        break;
      case "payrollRun":
        primaryKeyField = "run_id";
        break;
      default:
        primaryKeyField = "id";
    }

    // Validate if the model exists in Prisma
    if (!prisma[singularModelName]) {
      logger.warn({
        message: `Model not found for ${singularModelName}`,
        metadata: {
          objectType,
          modelName: singularModelName,
          timestamp: new Date().toISOString(),
        },
      });
      return res.status(404).json({
        status: "error",
        message: `Entity type ${objectType} not found`,
      });
    }

    // Create where clause for findUnique
    const where = { [primaryKeyField]: id };

    // Validate the UUID format before querying to avoid Prisma errors
    let entity;
    try {
      // Check if the ID is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        logger.warn({
          message: `Invalid UUID format for ${objectType} ID`,
          metadata: {
            objectType,
            id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(400).json({
          status: "error",
          message: `Invalid format for ${objectType} ID: ${id}. Expected a valid UUID.`,
        });
      }

      // After validation, query the database
      entity = await prisma[singularModelName].findUnique({ where });

      if (!entity) {
        logger.info({
          message: `${objectType} with ID ${id} not found`,
          metadata: {
            objectType,
            id,
            timestamp: new Date().toISOString(),
          },
        });
        return res.status(404).json({
          status: "error",
          message: `${objectType} with ID ${id} not found`,
        });
      }
    } catch (prismaError) {
      // Handle other Prisma errors
      logger.error({
        message: `Database error when querying ${objectType}`,
        metadata: {
          error: prismaError.message,
          stack: prismaError.stack,
          objectType,
          id,
          timestamp: new Date().toISOString(),
        },
      });
      return res.status(500).json({
        status: "error",
        message: `Error retrieving ${objectType}: ${prismaError.message}`,
      });
    }

    return res.status(200).json({
      status: "success",
      data: entity,
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving entity by ID`,
      metadata: {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
    });
    return next(new AppError(`Error retrieving entity: ${error.message}`, 500));
  }
});
