//      THIS IS DEAD CODE JUST FOR THE TESTING PURPOSE///
const axios = require("axios");
const mqService = require("./mqService");
const validationService = require("./validationService");
const { logger } = require("../utils/logger");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class ConsumePassedData {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
    this.processedObjectsCache = [];
    this.objectsToProcess = [];

    // Define the insertion sequence order
    this.insertionSequence = [
      "Organization",
      "BankMaster",
      "OrganizationBankDetail",
      "OrganizationTaxDetail",
      "OrganizationComplianceDetail",
      "CountryMaster",
      "StateMaster",
      "OrganizationLocation",
      "DepartmentType",
      "Department",
      "EmploymentType",
      "JobTitle",
      "Employee",
      "EmployeePersonalDetail",
      "EmployeeBankDetail",
      "EmployeeFinancialDetail",
      "SalaryComponentMaster",
      "SalaryStructure",
      "SalaryStructureComponent",
      "EmployeeSalary",
      "PayrollCycle",
      "PayrollRun",
      "PolicyModule",
      "PolicySetting",
      "ProbationPolicy",
      "PolicyDocumentVersion",
      "PolicyAcknowledgment",
      "LeavePolicyConfiguration",
      "HolidayCalendarYear",
      "HolidayMaster",
      "HolidayCalendarDetail",
      "AttendanceSettings",
      "ShiftConfiguration",
      "EmployeeShiftAssignment",
    ];

    // Map schemas to their identifiers
    this.schemaMap = {
      org_id: "Organization",
      bank_id: "BankMaster",
      org_bank_id: "OrganizationBankDetail",
      org_tax_id: "OrganizationTaxDetail",
      org_compliance_id: "OrganizationComplianceDetail",
      country_id: "CountryMaster",
      state_id: "StateMaster",
      location_id: "OrganizationLocation",
      dept_type_id: "DepartmentType",
      dept_id: "Department",
      employment_type_id: "EmploymentType",
      job_title_id: "JobTitle",
      employee_id: "Employee", // Note: This is checked further in identifySchema
      empl_personal_det_id: "EmployeePersonalDetail",
      employee_bank_id: "EmployeeBankDetail",
      empl_financial_id: "EmployeeFinancialDetail",
      component_id: "SalaryComponentMaster",
      structure_id: "SalaryStructure",
      structure_component_id: "SalaryStructureComponent",
      salary_id: "EmployeeSalary",
      cycle_id: "PayrollCycle",
      run_id: "PayrollRun",
      module_id: "PolicyModule",
      setting_id: "PolicySetting",
      probation_policy_id: "ProbationPolicy",
      version_id: "PolicyDocumentVersion",
      acknowledgment_id: "PolicyAcknowledgment",
      leave_policy_id: "LeavePolicyConfiguration",
      calendar_year_id: "HolidayCalendarYear",
      holiday_id: "HolidayMaster",
      calendar_detail_id: "HolidayCalendarDetail",
      attendance_settings_id: "AttendanceSettings",
      shift_id: "ShiftConfiguration",
      shift_assignment_id: "EmployeeShiftAssignment",
    };
  }

  /**
   * Validate foreign key references before inserting data
   * @param {Object} data - The data object
   * @param {string} schemaName - The schema name
   * @returns {Promise<boolean>} - Whether foreign key references exist
   */
  async validateForeignKeyReferences(data, schemaName) {
    // Add specific validation per schema type as needed
    try {
      switch (schemaName) {
        case "Employee":
          return await this.validateEmployeeForeignKeys(data);
        case "EmployeePersonalDetail":
          // Verify employee exists
          return await this.entityExists("Employee", data.employee_id);
        case "EmployeeBankDetail":
          // Verify employee exists
          return await this.entityExists("Employee", data.employee_id);
        case "EmployeeFinancialDetail":
          // Verify employee exists
          return await this.entityExists("Employee", data.employee_id);
        case "EmployeeSalary":
          // Verify employee and salary structure exist
          const employeeExists = await this.entityExists(
            "Employee",
            data.employee_id
          );
          const structureExists = await this.entityExists(
            "SalaryStructure",
            data.structure_id
          );
          return employeeExists && structureExists;
        case "PolicySetting":
          // Verify policy module exists
          return await this.entityExists("PolicyModule", data.module_id);
        case "PolicyDocumentVersion":
          // Verify policy module exists
          return await this.entityExists("PolicyModule", data.module_id);
        case "PolicyAcknowledgment":
          // Verify policy document version exists
          return await this.entityExists(
            "PolicyDocumentVersion",
            data.version_id
          );
        // Add more cases for other schema types that need validation
        default:
          return true;
      }
    } catch (error) {
      logger.error({
        message: `Error validating foreign key references for ${schemaName}`,
        metadata: {
          error: error.message,
          stack: error.stack,
          data,
          timestamp: new Date().toISOString(),
        },
      });
      return false;
    }
  }

  /**
   * Start the RabbitMQ consumer
   */
  async startConsumer() {
    try {
      const channel = await mqService.connect();

      // Ensure the queue exists
      await channel.assertQueue(mqService.passedQueue, {
        durable: true,
      });

      logger.info({
        message: "Starting consumer for passed data",
        metadata: {
          queue: mqService.passedQueue,
          timestamp: new Date().toISOString(),
        },
      });

      // Consume messages from the queue
      await channel.consume(mqService.passedQueue, async (msg) => {
        if (!msg) return;

        const content = JSON.parse(msg.content.toString());

        try {
          // Process the message
          await this.processMessage(content);

          // Acknowledge the message
          try {
            if (
              channel &&
              channel.connection &&
              channel.connection.connection &&
              channel.connection.connection.writable
            ) {
              channel.ack(msg);
            }

            logger.info({
              message: "Message processed successfully",
              metadata: {
                messageId: msg.properties.messageId,
                timestamp: new Date().toISOString(),
              },
            });
          } catch (ackError) {
            logger.error({
              message: "Error acknowledging message",
              metadata: {
                error: ackError.message,
                timestamp: new Date().toISOString(),
              },
            });
          }
        } catch (error) {
          // Negative acknowledge the message in case of errors
          try {
            if (
              channel &&
              channel.connection &&
              channel.connection.connection &&
              channel.connection.connection.writable
            ) {
              channel.nack(msg, false, false);
            }
          } catch (nackError) {
            logger.error({
              message: "Error rejecting message",
              metadata: {
                error: nackError.message,
                timestamp: new Date().toISOString(),
              },
            });
          }

          logger.error({
            message: "Error processing message",
            metadata: {
              error: error.message,
              stack: error.stack,
              messageId: msg.properties.messageId,
              timestamp: new Date().toISOString(),
            },
          });

          // Publish the message to the failed queue
          try {
            await mqService.publishToFailed(
              content,
              `Failed to process message: ${error.message}`
            );
          } catch (publishError) {
            logger.error({
              message: "Error publishing to failed queue",
              metadata: {
                error: publishError.message,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      });
    } catch (error) {
      logger.error({
        message: "Failed to start consumer",
        metadata: {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
      });
      // Retry starting the consumer after a delay
      setTimeout(() => this.startConsumer(), 5000);
    }
  }

  /**
   * Process a message received from the queue
   * @param {Object} data - The message data
   */
  async processMessage(data) {
    // Identify which schema the object belongs to
    const schemaName = this.identifySchema(data);

    if (!schemaName) {
      logger.error({
        message: "Unable to identify schema for object",
        metadata: {
          data,
          timestamp: new Date().toISOString(),
        },
      });

      await mqService.publishToFailed(
        data,
        "Failed to identify schema for object"
      );
      return;
    }

    logger.info({
      message: "Schema identified for object",
      metadata: {
        schemaName,
        objectId: this.getPrimaryKeyValue(data, schemaName),
        timestamp: new Date().toISOString(),
      },
    });

    // Skip validation since data is already validated by testQueue.js before being published
    logger.info({
      message: "Skipping validation for pre-validated object",
      metadata: {
        schemaName,
        objectId: this.getPrimaryKeyValue(data, schemaName),
        timestamp: new Date().toISOString(),
      },
    });

    // Add object to the list for sequential processing
    this.objectsToProcess.push({
      data,
      schemaName,
    });

    // After collecting all objects, process them in the defined sequence
    await this.processObjectsInSequence();
  }

  /**
   * Process all collected objects in the defined insertion sequence
   */
  async processObjectsInSequence() {
    // Group objects by schema name
    const objectsBySchema = {};

    for (const item of this.objectsToProcess) {
      if (!objectsBySchema[item.schemaName]) {
        objectsBySchema[item.schemaName] = [];
      }
      objectsBySchema[item.schemaName].push(item.data);
    }

    // Process objects in the defined sequence
    for (const schemaName of this.insertionSequence) {
      const objects = objectsBySchema[schemaName] || [];

      if (objects.length > 0) {
        logger.info({
          message: `Processing ${objects.length} ${schemaName} objects in sequence`,
          timestamp: new Date().toISOString(),
        });

        for (const data of objects) {
          try {
            // Validate foreign key references before insertion
            const referencesValid = await this.validateForeignKeyReferences(
              data,
              schemaName
            );

            if (!referencesValid) {
              logger.warn({
                message: `Skipping ${schemaName} object due to missing foreign key references`,
                metadata: {
                  objectId: this.getPrimaryKeyValue(data, schemaName),
                  timestamp: new Date().toISOString(),
                },
              });

              // Publish to failed queue if foreign keys are missing
              await mqService.publishToFailed(
                data,
                `Failed to process ${schemaName} object: Foreign key references not found`
              );
              continue;
            }

            // Insert the data into the database with retry logic
            await this.insertWithRetry(data, schemaName);
          } catch (error) {
            logger.error({
              message: `Failed to process ${schemaName} object`,
              metadata: {
                error: error.message,
                stack: error.stack,
                objectId: this.getPrimaryKeyValue(data, schemaName),
                timestamp: new Date().toISOString(),
              },
            });

            await mqService.publishToFailed(
              data,
              `Failed to process ${schemaName} object: ${error.message}`
            );
          }
        }
      }
    }

    // Clear the objects list after processing
    this.objectsToProcess = [];
  }

  /**
   * Identify which schema an object belongs to based on its properties
   * @param {Object} data - The data object
   * @returns {string|null} - The schema name or null if not identified
   */
  identifySchema(data) {
    // Log the data object properties to help with debugging
    logger.info({
      message: "Identifying schema for data object",
      metadata: {
        keys: Object.keys(data),
        hasOrgBankId: data.hasOwnProperty("org_bank_id"),
        hasOrgId: data.hasOwnProperty("org_id"),
        timestamp: new Date().toISOString(),
      },
    });

    // Prioritize specific unique identifiers for each schema
    for (const [key, schema] of Object.entries(this.schemaMap)) {
      if (data.hasOwnProperty(key)) {
        // Additional checks for specific schemas to avoid misidentification
        switch (key) {
          case "org_id":
            // Check for JobTitle first
            if (
              data.hasOwnProperty("job_title_id") ||
              (data.hasOwnProperty("title_name") &&
                data.hasOwnProperty("title_code"))
            ) {
              logger.info({
                message:
                  "Identified as JobTitle based on job_title_id or title fields",
                metadata: {
                  jobTitleId: data.job_title_id,
                  orgId: data.org_id,
                },
              });
              return "JobTitle";
            }
            // Ensure it's an Organization and not a reference from another table
            else if (
              !data.hasOwnProperty("employee_id") && // Not an Employee relation
              !data.hasOwnProperty("location_id") && // Not an OrganizationLocation relation
              !data.hasOwnProperty("dept_id") && // Not a Department relation
              !data.hasOwnProperty("org_bank_id") && // Not an OrganizationBankDetail
              !data.hasOwnProperty("org_tax_id") && // Not an OrganizationTaxDetail
              !data.hasOwnProperty("org_compliance_id") // Not an OrganizationComplianceDetail
            ) {
              logger.info({
                message:
                  "Identified as Organization based on org_id and absence of other relation IDs",
                metadata: {
                  orgId: data.org_id,
                },
              });
              return "Organization";
            }
            break;

          case "employee_id":
            // Check specific employee-related tables
            if (data.hasOwnProperty("empl_personal_det_id")) {
              return "EmployeePersonalDetail";
            } else if (data.hasOwnProperty("employee_bank_id")) {
              return "EmployeeBankDetail";
            } else if (data.hasOwnProperty("empl_financial_id")) {
              return "EmployeeFinancialDetail";
            } else if (data.hasOwnProperty("salary_id")) {
              return "EmployeeSalary";
            } else if (
              data.hasOwnProperty("first_name") &&
              data.hasOwnProperty("last_name")
            ) {
              return "Employee";
            }
            break;

          case "org_bank_id":
            return "OrganizationBankDetail";

          case "org_tax_id":
            return "OrganizationTaxDetail";

          case "org_compliance_id":
            return "OrganizationComplianceDetail";

          default:
            return schema;
        }
      }
    }

    // For cases where standard detection fails

    // Try to identify by common characteristics if not identified by ID field
    // AttendanceSettings identification
    if (
      data.hasOwnProperty("id") &&
      data.hasOwnProperty("organizationId") &&
      data.hasOwnProperty("shiftType") &&
      data.hasOwnProperty("geoFencingEnabled") &&
      data.hasOwnProperty("overtimePolicyEnabled")
    ) {
      return "AttendanceSettings";
    }

    // ShiftConfiguration identification
    if (
      data.hasOwnProperty("id") &&
      data.hasOwnProperty("organizationId") &&
      data.hasOwnProperty("shiftName") &&
      data.hasOwnProperty("shiftType")
    ) {
      return "ShiftConfiguration";
    }

    return null;
  }

  /**
   * Validate employee foreign keys
   * @param {Object} data - The employee data
   * @returns {Promise<boolean>} - Whether all foreign keys exist
   */
  async validateEmployeeForeignKeys(data) {
    try {
      // Check Organization exists
      const orgExists = await this.entityExists("Organization", data.org_id);
      if (!orgExists) return false;

      // Check Department exists if provided
      if (data.dept_id) {
        const deptExists = await this.entityExists("Department", data.dept_id);
        if (!deptExists) return false;
      }

      // Check JobTitle exists if provided
      if (data.job_title_id) {
        const jobTitleExists = await this.entityExists(
          "JobTitle",
          data.job_title_id
        );
        if (!jobTitleExists) return false;
      }

      // Check EmploymentType exists if provided
      if (data.employment_type_id) {
        const empTypeExists = await this.entityExists(
          "EmploymentType",
          data.employment_type_id
        );
        if (!empTypeExists) return false;
      }

      return true;
    } catch (error) {
      logger.error({
        message: `Unexpected error during employee foreign key validation`,
        metadata: {
          error: error.message,
          stack: error.stack,
          employee_id: data.employee_id,
          timestamp: new Date().toISOString(),
        },
      });
      return false;
    }
  }

  /**
   * Check if an entity exists in the database
   * @param {string} entityType - The type of entity to check
   * @param {string} entityId - The ID of the entity
   * @returns {Promise<boolean>} - Whether the entity exists
   */
  async entityExists(entityType, entityId) {
    if (!entityId || !validationService.isValidUUID(entityId)) {
      logger.warn({
        message: `Invalid ID format for ${entityType} existence check`,
        metadata: {
          entityType,
          entityId,
          timestamp: new Date().toISOString(),
        },
      });
      return false;
    }

    try {
      // Map entity types to corresponding Prisma model names (camelCase)
      const modelMapping = {
        Employee: "employee",
        Organization: "organization",
        OrganizationLocation: "organizationLocation",
        Department: "department",
        JobTitle: "jobTitle",
        EmploymentType: "employmentType",
        BankMaster: "bankMaster",
        PolicyModule: "policyModule",
        PolicySetting: "policySetting",
        SalaryStructure: "salaryStructure",
        ShiftConfiguration: "shiftConfiguration",
        EmployeePersonalDetail: "employeePersonalDetail",
        EmployeeBankDetail: "employeeBankDetail",
        EmployeeFinancialDetail: "employeeFinancialDetail",
        EmployeeSalary: "employeeSalary",
        PayrollCycle: "payrollCycle",
        PayrollRun: "payrollRun",
        PolicyDocumentVersion: "policyDocumentVersion",
      };

      // Map entity types to their respective primary key field names (snake_case)
      const primaryKeyMapping = {
        Organization: "org_id",
        BankMaster: "bank_id",
        OrganizationBankDetail: "org_bank_id",
        OrganizationTaxDetail: "org_tax_id",
        OrganizationComplianceDetail: "org_compliance_id",
        CountryMaster: "country_id",
        StateMaster: "state_id",
        OrganizationLocation: "location_id",
        DepartmentType: "dept_type_id",
        Department: "dept_id",
        EmploymentType: "employment_type_id",
        JobTitle: "job_title_id",
        Employee: "employee_id",
        EmployeePersonalDetail: "empl_personal_det_id",
        EmployeeBankDetail: "employee_bank_id",
        EmployeeFinancialDetail: "empl_financial_id",
        SalaryComponentMaster: "component_id",
        SalaryStructure: "structure_id",
        SalaryStructureComponent: "structure_component_id",
        EmployeeSalary: "salary_id",
        PayrollCycle: "cycle_id",
        PayrollRun: "run_id",
        PolicyModule: "module_id",
        PolicySetting: "setting_id",
        ProbationPolicy: "probation_policy_id",
        PolicyDocumentVersion: "version_id",
        PolicyAcknowledgment: "acknowledgment_id",
      };

      const modelName = modelMapping[entityType];
      const primaryKeyField = primaryKeyMapping[entityType];

      if (!modelName || !primaryKeyField) {
        logger.warn({
          message: `Unknown entity type: ${entityType}`,
          metadata: {
            entityId,
            timestamp: new Date().toISOString(),
          },
        });
        return false;
      }

      // Create a where clause to find the entity
      const whereClause = {};
      whereClause[primaryKeyField] = entityId;

      // Use Prisma to find the entity
      const entity = await prisma[modelName].findUnique({
        where: whereClause,
      });

      return !!entity;
    } catch (error) {
      logger.error({
        message: `Error checking if ${entityType} exists`,
        metadata: {
          error: error.message,
          stack: error.stack,
          entityType,
          entityId,
          timestamp: new Date().toISOString(),
        },
      });
      return false;
    }
  }

  /**
   * Get the primary key value from data based on schema
   * @param {Object} data - The data object
   * @param {string} schemaName - The schema name
   * @returns {string|null} - The primary key value
   */
  getPrimaryKeyValue(data, schemaName) {
    // Map schemas to their primary key fields
    const primaryKeyMap = {
      Organization: "org_id",
      BankMaster: "bank_id",
      OrganizationBankDetail: "org_bank_id",
      OrganizationTaxDetail: "org_tax_id",
      OrganizationComplianceDetail: "org_compliance_id",
      CountryMaster: "country_id",
      StateMaster: "state_id",
      OrganizationLocation: "location_id",
      DepartmentType: "dept_type_id",
      Department: "dept_id",
      EmploymentType: "employment_type_id",
      JobTitle: "job_title_id",
      Employee: "employee_id",
      EmployeePersonalDetail: "empl_personal_det_id",
      EmployeeBankDetail: "employee_bank_id",
      EmployeeFinancialDetail: "empl_financial_id",
      SalaryComponentMaster: "component_id",
      SalaryStructure: "structure_id",
      SalaryStructureComponent: "structure_component_id",
      EmployeeSalary: "salary_id",
      PayrollCycle: "cycle_id",
      PayrollRun: "run_id",
      PolicyModule: "module_id",
      PolicySetting: "setting_id",
      ProbationPolicy: "probation_policy_id",
      PolicyDocumentVersion: "version_id",
      PolicyAcknowledgment: "acknowledgment_id",
      LeavePolicyConfiguration: "leave_policy_id",
      HolidayCalendarYear: "calendar_year_id",
      HolidayMaster: "holiday_id",
      HolidayCalendarDetail: "calendar_detail_id",
      AttendanceSettings: "attendance_settings_id",
      ShiftConfiguration: "shift_id",
      EmployeeShiftAssignment: "shift_assignment_id",
    };

    const primaryKeyField = primaryKeyMap[schemaName];
    if (!primaryKeyField) return null;

    return data[primaryKeyField];
  }

  /**
   * Insert data into database with retry logic
   * @param {Object} data - The data to insert
   * @param {string} schemaName - The schema name
   * @param {number} attempt - The current attempt number
   * @returns {Promise<Object>} - The inserted data
   */
  async insertWithRetry(data, schemaName, attempt = 1) {
    try {
      // Prepare data and API endpoint based on schema
      const apiUrl = process.env.API_BASE_URL || "http://localhost:8085";

      // Base API path from server configuration
      const apiBasePath = "/api/v1/tenant-onboarding";

      // Map schema names to API objectType parameter
      // The route is set up as POST to '/:objectType'
      const objectTypeMap = {
        Organization: "organizations",
        BankMaster: "banks",
        OrganizationBankDetail: "organization-bank-details",
        OrganizationTaxDetail: "organization-tax-details",
        OrganizationComplianceDetail: "organization-compliance-details",
        CountryMaster: "countries",
        StateMaster: "states",
        OrganizationLocation: "organization-locations",
        DepartmentType: "department-types",
        Department: "departments",
        EmploymentType: "employment-types",
        JobTitle: "job-titles",
        Employee: "employees",
        EmployeePersonalDetail: "employee-personal-details",
        EmployeeBankDetail: "employee-bank-details",
        EmployeeFinancialDetail: "employee-financial-details",
        SalaryComponentMaster: "salary-components",
        SalaryStructure: "salary-structures",
        SalaryStructureComponent: "salary-structure-components",
        EmployeeSalary: "employee-salaries",
        PayrollCycle: "payroll-cycles",
        PayrollRun: "payroll-runs",
        PolicyModule: "policy-modules",
        PolicySetting: "policy-settings",
        ProbationPolicy: "probation-policies",
        PolicyDocumentVersion: "policy-document-versions",
        PolicyAcknowledgment: "policy-acknowledgments",
        LeavePolicyConfiguration: "leave-policy-configurations",
        HolidayCalendarYear: "holiday-calendar-years",
        HolidayMaster: "holiday-masters",
        HolidayCalendarDetail: "holiday-calendar-details",
        AttendanceSettings: "attendance-settings",
        ShiftConfiguration: "shift-configurations",
        EmployeeShiftAssignment: "employee-shift-assignments",
      };

      // Get the objectType parameter - either from map or convert from schema name
      const objectType =
        objectTypeMap[schemaName] ||
        schemaName.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

      // Construct the endpoint path
      const endpoint = `${apiBasePath}/${objectType}`;

      // Transform data to match API expected format
      const transformedData = this.transformDataForApi(data, schemaName);

      logger.info({
        message: `Attempting to insert ${schemaName} data (attempt ${attempt})`,
        metadata: {
          objectId: this.getPrimaryKeyValue(data, schemaName),
          endpoint,
          timestamp: new Date().toISOString(),
        },
      });

      // Make API call to insert data
      const response = await axios.post(
        `${apiUrl}${endpoint}`,
        transformedData
      );

      // Add to processed cache
      this.addToCache(data, schemaName, response.data);

      logger.info({
        message: `Successfully inserted ${schemaName} data`,
        metadata: {
          objectId: this.getPrimaryKeyValue(data, schemaName),
          timestamp: new Date().toISOString(),
        },
      });

      return response.data;
    } catch (error) {
      // If it's a server error (5xx) or connection error, retry up to maxRetries
      const isRetryableError =
        (error.response && error.response.status >= 500) ||
        error.code === "ECONNREFUSED" ||
        error.code === "ECONNRESET";

      if (isRetryableError && attempt < this.maxRetries) {
        logger.warn({
          message: `Retrying ${schemaName} insertion after error (attempt ${attempt})`,
          metadata: {
            error: error.message,
            objectId: this.getPrimaryKeyValue(data, schemaName),
            attempt,
            timestamp: new Date().toISOString(),
          },
        });

        // Wait for retry delay
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));

        // Recursive retry with incremented attempt count
        return this.insertWithRetry(data, schemaName, attempt + 1);
      }

      // If max retries reached or non-retryable error, throw the error
      logger.error({
        message: `Failed to insert ${schemaName} data after ${attempt} attempts`,
        metadata: {
          error: error.message,
          stack: error.stack,
          response: error.response?.data,
          objectId: this.getPrimaryKeyValue(data, schemaName),
          timestamp: new Date().toISOString(),
        },
      });

      throw error;
    }
  }

  /**
   * Add processed data to cache
   * @param {Object} originalData - The original data object
   * @param {string} schemaName - The schema name
   * @param {Object} responseData - The response data from API
   */
  addToCache(originalData, schemaName, responseData) {
    this.processedObjectsCache.push({
      schemaName,
      id: this.getPrimaryKeyValue(originalData, schemaName),
      data: responseData,
    });

    // Keep cache size manageable
    if (this.processedObjectsCache.length > 1000) {
      this.processedObjectsCache.shift();
    }
  }

  /**
   * Transform data to format expected by API
   * @param {Object} data - The data to transform
   * @param {string} schemaName - The schema name
   * @returns {Object} - Transformed data
   */
  transformDataForApi(data, schemaName) {
    // Create a deep copy of the data to avoid modifying the original
    const transformedData = JSON.parse(JSON.stringify(data));

    // Log the input data and schema for debugging
    logger.info({
      message: `Transforming data for API - Schema: ${schemaName}`,
      metadata: {
        schema: schemaName,
        objectKeys: Object.keys(transformedData),
        timestamp: new Date().toISOString(),
      },
    });

    // For JobTitle, remove any Organization-specific fields that might have been mixed in
    if (schemaName === "JobTitle") {
      const jobTitleFields = [
        "job_title_id",
        "org_id",
        "title_name",
        "title_code",
        "title_description",
        "grade_level",
        "created_at",
        "updated_at",
        "status",
      ];
      const fieldsToRemove = [];

      // Identify fields that don't belong to JobTitle
      for (const key of Object.keys(transformedData)) {
        if (!jobTitleFields.includes(key)) {
          fieldsToRemove.push(key);
        }
      }

      // Remove identified fields
      if (fieldsToRemove.length > 0) {
        logger.warn({
          message: `Removing Organization-specific fields from JobTitle data`,
          metadata: {
            fieldsRemoved: fieldsToRemove,
            job_title_id: transformedData.job_title_id,
          },
        });

        for (const key of fieldsToRemove) {
          delete transformedData[key];
        }
      }
    }

    // Format date fields - convert string dates to ISO format
    if (transformedData) {
      Object.keys(transformedData).forEach((key) => {
        // Check if field contains date information
        if (
          typeof transformedData[key] === "string" &&
          (key.toLowerCase().includes("date") ||
            key.toLowerCase().includes("dob") ||
            key.toLowerCase().includes("birthdate") ||
            key.toLowerCase().includes("created") ||
            key.toLowerCase().includes("updated") ||
            key.toLowerCase().includes("at"))
        ) {
          try {
            // Try to parse as date and convert to ISO string
            const dateObj = new Date(transformedData[key]);
            if (!isNaN(dateObj.getTime())) {
              transformedData[key] = dateObj.toISOString();
            }
          } catch (error) {
            // If date parsing fails, keep original value
            logger.warn({
              message: `Failed to parse date field ${key}`,
              metadata: {
                value: transformedData[key],
                error: error.message,
              },
            });
          }
        }
      });
    }

    // Handle specific schema types
    switch (schemaName) {
      case "Organization":
        // Ensure organization data has all required fields
        if (
          !transformedData.legal_entity_name ||
          transformedData.legal_entity_name.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing legal_entity_name for Organization, attempting to derive from other fields",
            metadata: {
              org_id: transformedData.org_id,
              hasName: Boolean(transformedData.name),
              hasCompanyName: Boolean(transformedData.company_name),
              hasOrgName: Boolean(transformedData.org_name),
              hasEntityName: Boolean(transformedData.entity_name),
            },
          });

          // Try to derive from other fields with extended field checking
          if (transformedData.name && transformedData.name.trim() !== "") {
            transformedData.legal_entity_name = transformedData.name.trim();
          } else if (
            transformedData.company_name &&
            transformedData.company_name.trim() !== ""
          ) {
            transformedData.legal_entity_name =
              transformedData.company_name.trim();
          } else if (
            transformedData.org_name &&
            transformedData.org_name.trim() !== ""
          ) {
            transformedData.legal_entity_name = transformedData.org_name.trim();
          } else if (
            transformedData.entity_name &&
            transformedData.entity_name.trim() !== ""
          ) {
            transformedData.legal_entity_name =
              transformedData.entity_name.trim();
          } else if (
            transformedData.business_name &&
            transformedData.business_name.trim() !== ""
          ) {
            transformedData.legal_entity_name =
              transformedData.business_name.trim();
          } else {
            // As a last resort, use a placeholder name with the org_id
            transformedData.legal_entity_name = `Organization ${transformedData.org_id || "Unknown"}`;
          }

          logger.info({
            message: "Updated legal_entity_name for Organization",
            metadata: {
              org_id: transformedData.org_id,
              legal_entity_name: transformedData.legal_entity_name,
            },
          });
        }

        // Ensure required fields for Organization have values
        if (
          !transformedData.auth_signatory_name ||
          transformedData.auth_signatory_name.trim() === ""
        ) {
          transformedData.auth_signatory_name =
            transformedData.legal_entity_name;
        }

        // Ensure status field has a valid value
        if (
          !transformedData.status ||
          !["active", "inactive"].includes(transformedData.status.toLowerCase())
        ) {
          transformedData.status = "active";
        }

        // Convert status to lowercase
        transformedData.status = transformedData.status.toLowerCase();
        break;

      case "OrganizationBankDetail":
        // Ensure all required fields are present and formatted correctly
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for OrganizationBankDetail",
            metadata: {
              org_bank_id: transformedData.org_bank_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure bank_id is present
        if (!transformedData.bank_id) {
          logger.error({
            message: "Missing bank_id for OrganizationBankDetail",
            metadata: {
              org_bank_id: transformedData.org_bank_id,
              org_id: transformedData.org_id,
            },
          });
          return null; // Cannot proceed without bank_id
        }

        // Ensure account_number is present
        if (!transformedData.account_number) {
          logger.warn({
            message:
              "Missing account_number for OrganizationBankDetail, using default",
            metadata: {
              org_bank_id: transformedData.org_bank_id,
            },
          });
          transformedData.account_number = `ACC-${transformedData.org_bank_id.substring(0, 8)}`;
        }

        // Ensure status field has a valid value
        if (
          !transformedData.status ||
          !["active", "inactive"].includes(transformedData.status.toLowerCase())
        ) {
          transformedData.status = "active";
        }

        // Convert status to lowercase
        transformedData.status = transformedData.status.toLowerCase();

        // Ensure is_primary is a boolean
        if (transformedData.is_primary !== undefined) {
          transformedData.is_primary = Boolean(transformedData.is_primary);
        } else {
          transformedData.is_primary = true; // Default value
        }
        break;

      case "BankMaster":
        // Ensure all required fields are present and formatted correctly
        if (
          !transformedData.bank_name ||
          transformedData.bank_name.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing bank_name for BankMaster, attempting to derive from other fields",
            metadata: {
              bank_id: transformedData.bank_id,
              hasName: Boolean(transformedData.name),
            },
          });

          // Try to derive from other fields
          if (transformedData.name && transformedData.name.trim() !== "") {
            transformedData.bank_name = transformedData.name.trim();
          } else {
            transformedData.bank_name = `Bank ${transformedData.bank_id || "Unknown"}`;
          }
        }

        // Ensure bank_type is present
        if (
          !transformedData.bank_type ||
          transformedData.bank_type.trim() === ""
        ) {
          transformedData.bank_type = "commercial";
        }

        // Ensure is_active is a boolean
        if (transformedData.is_active !== undefined) {
          transformedData.is_active = Boolean(transformedData.is_active);
        } else {
          transformedData.is_active = true; // Default value
        }
        break;

      case "OrganizationTaxDetail":
        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for OrganizationTaxDetail",
            metadata: {
              org_tax_id: transformedData.org_tax_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure pan (Permanent Account Number) is present for tax details
        if (!transformedData.pan || transformedData.pan.trim() === "") {
          logger.warn({
            message: "Missing PAN for OrganizationTaxDetail, using default",
            metadata: {
              org_tax_id: transformedData.org_tax_id,
            },
          });
          transformedData.pan = `PAN${transformedData.org_tax_id.substring(0, 8)}`;
        }

        // Ensure status field has a valid value
        if (
          !transformedData.status &&
          transformedData.is_active !== undefined
        ) {
          transformedData.status = transformedData.is_active
            ? "active"
            : "inactive";
        } else if (
          !transformedData.status ||
          !["active", "inactive"].includes(transformedData.status.toLowerCase())
        ) {
          transformedData.status = "active";
        }

        // Convert status to lowercase
        if (transformedData.status) {
          transformedData.status = transformedData.status.toLowerCase();
        }
        break;

      case "OrganizationComplianceDetail":
        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for OrganizationComplianceDetail",
            metadata: {
              org_compliance_id: transformedData.org_compliance_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure compliance_code is present
        if (
          !transformedData.compliance_code ||
          transformedData.compliance_code.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing compliance_code for OrganizationComplianceDetail, using default",
            metadata: {
              org_compliance_id: transformedData.org_compliance_id,
            },
          });
          transformedData.compliance_code = `COMP-${transformedData.org_compliance_id.substring(0, 6)}`;
        }

        // Ensure status field has a valid value
        if (
          !transformedData.status &&
          transformedData.is_active !== undefined
        ) {
          transformedData.status = transformedData.is_active
            ? "active"
            : "inactive";
        } else if (
          !transformedData.status ||
          !["active", "inactive"].includes(transformedData.status.toLowerCase())
        ) {
          transformedData.status = "active";
        }

        // Convert status to lowercase
        if (transformedData.status) {
          transformedData.status = transformedData.status.toLowerCase();
        }
        break;

      case "Employee":
        // Ensure employee has required fields
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for Employee",
            metadata: {
              employee_id: transformedData.employee_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure employee_number is present
        if (
          !transformedData.employee_number ||
          transformedData.employee_number.trim() === ""
        ) {
          logger.warn({
            message: "Missing employee_number for Employee, generating default",
            metadata: {
              employee_id: transformedData.employee_id,
            },
          });
          transformedData.employee_number = `EMP${transformedData.employee_id.substring(0, 6)}`;
        }

        // Ensure first_name and last_name are present
        if (
          !transformedData.first_name ||
          transformedData.first_name.trim() === ""
        ) {
          logger.warn({
            message: "Missing first_name for Employee, using default",
            metadata: {
              employee_id: transformedData.employee_id,
            },
          });
          transformedData.first_name = "Unknown";
        }

        if (
          !transformedData.last_name ||
          transformedData.last_name.trim() === ""
        ) {
          logger.warn({
            message: "Missing last_name for Employee, using default",
            metadata: {
              employee_id: transformedData.employee_id,
            },
          });
          transformedData.last_name = "Employee";
        }

        // Generate display_name if not present
        if (
          !transformedData.display_name ||
          transformedData.display_name.trim() === ""
        ) {
          const middleName = transformedData.middle_name
            ? ` ${transformedData.middle_name} `
            : " ";
          transformedData.display_name = `${transformedData.first_name}${middleName}${transformedData.last_name}`;
        }

        // Ensure at least one email is present
        if (
          (!transformedData.official_email ||
            transformedData.official_email.trim() === "") &&
          (!transformedData.personal_email ||
            transformedData.personal_email.trim() === "")
        ) {
          const defaultEmail = `${transformedData.first_name.toLowerCase()}.${transformedData.last_name.toLowerCase()}@example.com`;
          logger.warn({
            message:
              "Missing official_email and personal_email for Employee, using default for official_email",
            metadata: {
              employee_id: transformedData.employee_id,
              defaultEmail,
            },
          });
          transformedData.official_email = defaultEmail;
        }

        // Ensure mobile_number is present
        if (
          !transformedData.mobile_number ||
          transformedData.mobile_number.trim() === ""
        ) {
          logger.warn({
            message: "Missing mobile_number for Employee, using default",
            metadata: {
              employee_id: transformedData.employee_id,
            },
          });
          transformedData.mobile_number = "0000000000";
        }

        // Format date fields to correct ISO format
        const dateFields = [
          "date_of_birth",
          "date_joined",
          "probation_end_date",
          "confirmation_date",
          "contract_end_date",
        ];
        dateFields.forEach((field) => {
          if (transformedData[field]) {
            try {
              const date = new Date(transformedData[field]);
              if (!isNaN(date.getTime())) {
                transformedData[field] = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
              }
            } catch (error) {
              logger.warn({
                message: `Failed to format ${field} date for Employee`,
                metadata: {
                  employee_id: transformedData.employee_id,
                  value: transformedData[field],
                  error: error.message,
                },
              });
              // If date of birth or date joined is invalid, set to defaults
              if (field === "date_of_birth") {
                transformedData[field] = "1990-01-01"; // Default date of birth
              } else if (field === "date_joined") {
                transformedData[field] = new Date().toISOString().split("T")[0]; // Default to today
              } else {
                transformedData[field] = null; // Other date fields can be null
              }
            }
          } else if (field === "date_of_birth" || field === "date_joined") {
            // These are required fields, set defaults if missing
            if (field === "date_of_birth") {
              transformedData[field] = "1990-01-01"; // Default date of birth
            } else if (field === "date_joined") {
              transformedData[field] = new Date().toISOString().split("T")[0]; // Default to today
            }
          }
        });

        // Ensure gender is valid
        const validGenders = ["male", "female", "other", "prefer_not_to_say"];
        if (
          !transformedData.gender ||
          !validGenders.includes(transformedData.gender.toLowerCase())
        ) {
          logger.warn({
            message: "Invalid or missing gender for Employee, using default",
            metadata: {
              employee_id: transformedData.employee_id,
              provided_gender: transformedData.gender,
            },
          });
          transformedData.gender = "prefer_not_to_say"; // Default gender
        }

        // Convert gender to lowercase
        transformedData.gender = transformedData.gender.toLowerCase();

        // Set default for notice_period_days if not provided
        if (
          transformedData.notice_period_days === undefined ||
          transformedData.notice_period_days === null ||
          isNaN(parseInt(transformedData.notice_period_days))
        ) {
          transformedData.notice_period_days = 30; // Default notice period days
        } else if (typeof transformedData.notice_period_days === "string") {
          transformedData.notice_period_days = parseInt(
            transformedData.notice_period_days
          );
        }

        // Ensure status field has a valid value (employment_status)
        const validStatuses = [
          "active",
          "inactive",
          "terminated",
          "on_leave",
          "probation",
        ];
        if (
          !transformedData.status ||
          !validStatuses.includes(transformedData.status.toLowerCase())
        ) {
          transformedData.status = "active"; // Default to active
        }

        // Convert status to lowercase
        transformedData.status = transformedData.status.toLowerCase();
        break;

      case "EmployeePersonalDetail":
        // Ensure employee_id is present
        if (!transformedData.employee_id) {
          logger.error({
            message: "Missing employee_id for EmployeePersonalDetail",
            metadata: {
              empl_personal_det_id: transformedData.empl_personal_det_id,
            },
          });
          return null; // Cannot proceed without employee_id
        }

        // Format marital_status to match enum values
        if (transformedData.marital_status) {
          const validMaritalStatuses = [
            "single",
            "married",
            "divorced",
            "widowed",
            "separated",
          ];
          if (
            !validMaritalStatuses.includes(
              transformedData.marital_status.toLowerCase()
            )
          ) {
            logger.warn({
              message:
                "Invalid marital_status for EmployeePersonalDetail, using default",
              metadata: {
                empl_personal_det_id: transformedData.empl_personal_det_id,
                provided_status: transformedData.marital_status,
              },
            });
            transformedData.marital_status = "single"; // Default value
          } else {
            transformedData.marital_status =
              transformedData.marital_status.toLowerCase();
          }
        }

        // Format marriage_date if present
        if (transformedData.marriage_date) {
          try {
            const date = new Date(transformedData.marriage_date);
            if (!isNaN(date.getTime())) {
              transformedData.marriage_date = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
            }
          } catch (error) {
            logger.warn({
              message:
                "Failed to format marriage_date for EmployeePersonalDetail",
              metadata: {
                empl_personal_det_id: transformedData.empl_personal_det_id,
                value: transformedData.marriage_date,
                error: error.message,
              },
            });
            transformedData.marriage_date = null; // Set to null if invalid
          }
        }

        // Normalize blood_group (if provided)
        if (transformedData.blood_group) {
          transformedData.blood_group =
            transformedData.blood_group.toLowerCase();
        }

        // Ensure nationality is present
        if (
          !transformedData.nationality ||
          transformedData.nationality.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing nationality for EmployeePersonalDetail, using default",
            metadata: {
              empl_personal_det_id: transformedData.empl_personal_det_id,
            },
          });
          transformedData.nationality = "unknown"; // Default value
        } else {
          transformedData.nationality =
            transformedData.nationality.toLowerCase();
        }

        // Ensure physically_challenged is boolean
        transformedData.physically_challenged = Boolean(
          transformedData.physically_challenged
        );

        // Validate required fields: father_name and mother_name
        if (
          !transformedData.father_name ||
          transformedData.father_name.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing father_name for EmployeePersonalDetail, using default",
            metadata: {
              empl_personal_det_id: transformedData.empl_personal_det_id,
            },
          });
          transformedData.father_name = "Not Provided";
        }

        if (
          !transformedData.mother_name ||
          transformedData.mother_name.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing mother_name for EmployeePersonalDetail, using default",
            metadata: {
              empl_personal_det_id: transformedData.empl_personal_det_id,
            },
          });
          transformedData.mother_name = "Not Provided";
        }

        // Format spouse_gender to match enum (if provided)
        if (transformedData.spouse_gender) {
          const validGenders = ["male", "female", "other", "prefer_not_to_say"];
          if (
            !validGenders.includes(transformedData.spouse_gender.toLowerCase())
          ) {
            logger.warn({
              message:
                "Invalid spouse_gender for EmployeePersonalDetail, setting to null",
              metadata: {
                empl_personal_det_id: transformedData.empl_personal_det_id,
                provided_gender: transformedData.spouse_gender,
              },
            });
            transformedData.spouse_gender = null; // Set to null if invalid
          } else {
            transformedData.spouse_gender =
              transformedData.spouse_gender.toLowerCase();
          }
        }

        // Convert residence_number to string if it's a number
        if (
          transformedData.residence_number !== undefined &&
          transformedData.residence_number !== null
        ) {
          transformedData.residence_number = String(
            transformedData.residence_number
          );
        }

        // Ensure social_media_handles is JSON
        if (
          transformedData.social_media_handles &&
          typeof transformedData.social_media_handles === "string"
        ) {
          try {
            transformedData.social_media_handles = JSON.parse(
              transformedData.social_media_handles
            );
          } catch (error) {
            logger.warn({
              message:
                "Failed to parse social_media_handles as JSON for EmployeePersonalDetail",
              metadata: {
                empl_personal_det_id: transformedData.empl_personal_det_id,
                error: error.message,
              },
            });
            transformedData.social_media_handles = null; // Set to null if invalid
          }
        }
        break;

      case "EmployeeBankDetail":
        // Ensure employee_id is present
        if (!transformedData.employee_id) {
          logger.error({
            message: "Missing employee_id for EmployeeBankDetail",
            metadata: {
              employee_bank_id: transformedData.employee_bank_id,
            },
          });
          return null; // Cannot proceed without employee_id
        }

        // Ensure bank_id is present
        if (!transformedData.bank_id) {
          logger.error({
            message: "Missing bank_id for EmployeeBankDetail",
            metadata: {
              employee_bank_id: transformedData.employee_bank_id,
              employee_id: transformedData.employee_id,
            },
          });
          return null; // Cannot proceed without bank_id
        }

        // Ensure account_number is present and formatted as a string
        if (
          !transformedData.account_number ||
          transformedData.account_number.trim() === ""
        ) {
          logger.error({
            message: "Missing account_number for EmployeeBankDetail",
            metadata: {
              employee_bank_id: transformedData.employee_bank_id,
            },
          });
          return null; // Cannot proceed without account_number
        } else if (typeof transformedData.account_number === "number") {
          transformedData.account_number = String(
            transformedData.account_number
          );
        }

        // Format account_type to match enum values
        if (transformedData.account_type) {
          const validAccountTypes = ["savings", "current", "salary"];
          if (
            !validAccountTypes.includes(
              transformedData.account_type.toLowerCase()
            )
          ) {
            logger.warn({
              message:
                "Invalid account_type for EmployeeBankDetail, using default",
              metadata: {
                employee_bank_id: transformedData.employee_bank_id,
                provided_type: transformedData.account_type,
              },
            });
            transformedData.account_type = "salary"; // Default value
          } else {
            transformedData.account_type =
              transformedData.account_type.toLowerCase();
          }
        } else {
          transformedData.account_type = "salary"; // Default value
        }

        // Ensure ifsc_code is present
        if (
          !transformedData.ifsc_code ||
          transformedData.ifsc_code.trim() === ""
        ) {
          logger.error({
            message: "Missing ifsc_code for EmployeeBankDetail",
            metadata: {
              employee_bank_id: transformedData.employee_bank_id,
            },
          });
          return null; // Cannot proceed without ifsc_code
        } else {
          transformedData.ifsc_code = transformedData.ifsc_code.toUpperCase(); // Format to uppercase
        }

        // Ensure branch_name is present
        if (
          !transformedData.branch_name ||
          transformedData.branch_name.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing branch_name for EmployeeBankDetail, using default",
            metadata: {
              employee_bank_id: transformedData.employee_bank_id,
            },
          });
          transformedData.branch_name = "Main Branch"; // Default value
        }

        // Ensure name_on_account is present
        if (
          !transformedData.name_on_account ||
          transformedData.name_on_account.trim() === ""
        ) {
          logger.error({
            message: "Missing name_on_account for EmployeeBankDetail",
            metadata: {
              employee_bank_id: transformedData.employee_bank_id,
            },
          });
          return null; // Cannot proceed without name_on_account
        }

        // Ensure is_primary is boolean
        transformedData.is_primary = Boolean(transformedData.is_primary);

        // Format status to match enum values
        if (transformedData.status) {
          const validStatuses = ["active", "inactive"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            logger.warn({
              message: "Invalid status for EmployeeBankDetail, using default",
              metadata: {
                employee_bank_id: transformedData.employee_bank_id,
                provided_status: transformedData.status,
              },
            });
            transformedData.status = "active"; // Default value
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "active"; // Default value
        }
        break;

      case "EmployeeFinancialDetail":
        // Ensure employee_id is present
        if (!transformedData.employee_id) {
          logger.error({
            message: "Missing employee_id for EmployeeFinancialDetail",
            metadata: {
              empl_financial_id: transformedData.empl_financial_id,
            },
          });
          return null; // Cannot proceed without employee_id
        }

        // Format date fields correctly
        const financialDateFields = [
          "pf_joining_date",
          "dob_in_aadhar",
          "dob_in_pan",
        ];
        financialDateFields.forEach((field) => {
          if (transformedData[field]) {
            try {
              const date = new Date(transformedData[field]);
              if (!isNaN(date.getTime())) {
                transformedData[field] = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
              }
            } catch (error) {
              logger.warn({
                message: `Failed to format ${field} date for EmployeeFinancialDetail`,
                metadata: {
                  empl_financial_id: transformedData.empl_financial_id,
                  value: transformedData[field],
                  error: error.message,
                },
              });
              // Set to null if invalid
              transformedData[field] = null;
            }
          }
        });

        // Ensure all boolean fields are properly formatted
        const booleanFields = [
          "pf_details_available",
          "esi_details_available",
          "esi_eligible",
          "lwf_eligible",
          "pan_available",
        ];

        booleanFields.forEach((field) => {
          if (transformedData[field] !== undefined) {
            transformedData[field] = Boolean(transformedData[field]);
          }
        });

        // Ensure proper case for PF number and UAN
        if (transformedData.pf_number) {
          transformedData.pf_number = transformedData.pf_number.toUpperCase();
        }

        if (transformedData.uan) {
          transformedData.uan = transformedData.uan.toUpperCase();
        }

        // Validate salary_payment_mode
        if (transformedData.salary_payment_mode) {
          const validPaymentModes = ["cash", "cheque", "bank_transfer"];
          if (
            !validPaymentModes.includes(
              transformedData.salary_payment_mode.toLowerCase()
            )
          ) {
            logger.warn({
              message:
                "Invalid salary_payment_mode for EmployeeFinancialDetail, using default",
              metadata: {
                empl_financial_id: transformedData.empl_financial_id,
                provided_mode: transformedData.salary_payment_mode,
              },
            });
            transformedData.salary_payment_mode = "bank_transfer"; // Default value
          } else {
            transformedData.salary_payment_mode =
              transformedData.salary_payment_mode.toLowerCase();
          }
        } else {
          transformedData.salary_payment_mode = "bank_transfer"; // Default if not provided
        }

        // Ensure proper case for PAN number
        if (transformedData.pan_number) {
          transformedData.pan_number = transformedData.pan_number.toUpperCase();
        }

        // Format employer_esi_number
        if (
          transformedData.employer_esi_number &&
          typeof transformedData.employer_esi_number === "number"
        ) {
          transformedData.employer_esi_number = String(
            transformedData.employer_esi_number
          );
        }

        // Format aadhar_number
        if (
          transformedData.aadhar_number &&
          typeof transformedData.aadhar_number === "number"
        ) {
          transformedData.aadhar_number = String(transformedData.aadhar_number);
        }

        // Format currency values to ensure they're numeric
        ["basic_salary", "gross_salary", "net_salary", "ctc"].forEach(
          (field) => {
            if (transformedData[field] !== undefined) {
              // Convert string values to numbers if needed
              if (typeof transformedData[field] === "string") {
                transformedData[field] = parseFloat(
                  transformedData[field].replace(/[^\d.-]/g, "")
                );
              }

              // Ensure it's a valid number
              if (isNaN(transformedData[field])) {
                transformedData[field] = 0;
              }
            }
          }
        );
        break;

      case "AttendanceSettings":
        // Ensure required fields have proper format for AttendanceSettings
        if (transformedData.geoFencingEnabled !== undefined) {
          transformedData.geoFencingEnabled = Boolean(
            transformedData.geoFencingEnabled
          );
        }
        if (transformedData.overtimePolicyEnabled !== undefined) {
          transformedData.overtimePolicyEnabled = Boolean(
            transformedData.overtimePolicyEnabled
          );
        }
        break;

      case "SalaryComponentMaster":
        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for SalaryComponentMaster",
            metadata: {
              component_id: transformedData.component_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure component_name is present
        if (
          !transformedData.component_name ||
          transformedData.component_name.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing component_name for SalaryComponentMaster, using default",
            metadata: {
              component_id: transformedData.component_id,
            },
          });
          transformedData.component_name = `Component ${transformedData.component_id.substring(0, 8)}`;
        }

        // Ensure component_code is present
        if (
          !transformedData.component_code ||
          transformedData.component_code.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing component_code for SalaryComponentMaster, generating from name",
            metadata: {
              component_id: transformedData.component_id,
            },
          });
          // Generate code from name if missing
          transformedData.component_code = transformedData.component_name
            .toLowerCase()
            .replace(/\s+/g, "_")
            .substring(0, 20); // Limit to 20 chars
        }

        // Validate component_category
        if (transformedData.component_category) {
          const validCategories = [
            "earnings",
            "deductions",
            "benefits",
            "reimbursements",
          ];
          if (
            !validCategories.includes(
              transformedData.component_category.toLowerCase()
            )
          ) {
            logger.warn({
              message:
                "Invalid component_category for SalaryComponentMaster, using default",
              metadata: {
                component_id: transformedData.component_id,
                provided_category: transformedData.component_category,
              },
            });
            transformedData.component_category = "earnings"; // Default value
          } else {
            transformedData.component_category =
              transformedData.component_category.toLowerCase();
          }
        } else {
          transformedData.component_category = "earnings"; // Default if not provided
        }

        // Validate component_type
        if (transformedData.component_type) {
          const validTypes = ["fixed", "variable", "adhoc", "benefit"];
          if (
            !validTypes.includes(transformedData.component_type.toLowerCase())
          ) {
            logger.warn({
              message:
                "Invalid component_type for SalaryComponentMaster, using default",
              metadata: {
                component_id: transformedData.component_id,
                provided_type: transformedData.component_type,
              },
            });
            transformedData.component_type = "fixed"; // Default value
          } else {
            transformedData.component_type =
              transformedData.component_type.toLowerCase();
          }
        } else {
          transformedData.component_type = "fixed"; // Default if not provided
        }

        // Validate calculation_type
        if (transformedData.calculation_type) {
          const validCalcTypes = ["fixed", "percentage", "formula"];
          if (
            !validCalcTypes.includes(
              transformedData.calculation_type.toLowerCase()
            )
          ) {
            logger.warn({
              message:
                "Invalid calculation_type for SalaryComponentMaster, using default",
              metadata: {
                component_id: transformedData.component_id,
                provided_calc_type: transformedData.calculation_type,
              },
            });
            transformedData.calculation_type = "fixed"; // Default value
          } else {
            transformedData.calculation_type =
              transformedData.calculation_type.toLowerCase();
          }
        } else {
          transformedData.calculation_type = "fixed"; // Default if not provided
        }

        // Validate calculation_frequency
        if (transformedData.calculation_frequency) {
          const validFrequencies = [
            "monthly",
            "quarterly",
            "biannual",
            "annual",
            "one_time",
          ];
          if (
            !validFrequencies.includes(
              transformedData.calculation_frequency.toLowerCase()
            )
          ) {
            logger.warn({
              message:
                "Invalid calculation_frequency for SalaryComponentMaster, using default",
              metadata: {
                component_id: transformedData.component_id,
                provided_frequency: transformedData.calculation_frequency,
              },
            });
            transformedData.calculation_frequency = "monthly"; // Default value
          } else {
            transformedData.calculation_frequency =
              transformedData.calculation_frequency.toLowerCase();
          }
        } else {
          transformedData.calculation_frequency = "monthly"; // Default if not provided
        }

        // Ensure boolean fields are properly formatted
        const componentBooleanFields = [
          "is_taxable",
          "consider_for_ctc",
          "consider_for_esi",
          "consider_for_pf",
          "consider_for_bonus",
        ];

        componentBooleanFields.forEach((field) => {
          transformedData[field] = Boolean(transformedData[field]);
        });

        // Format decimal values
        ["min_value", "max_value"].forEach((field) => {
          if (
            transformedData[field] !== null &&
            transformedData[field] !== undefined
          ) {
            if (typeof transformedData[field] === "string") {
              transformedData[field] = parseFloat(
                transformedData[field].replace(/[^\d.-]/g, "")
              );

              if (isNaN(transformedData[field])) {
                transformedData[field] = null;
              }
            }
          }
        });

        // Ensure rounding_factor is an integer
        if (transformedData.rounding_factor !== undefined) {
          if (typeof transformedData.rounding_factor === "string") {
            transformedData.rounding_factor = parseInt(
              transformedData.rounding_factor
            );
          }

          if (isNaN(transformedData.rounding_factor)) {
            transformedData.rounding_factor = 0; // Default to 0
          }
        } else {
          transformedData.rounding_factor = 0; // Default to 0
        }

        // Set default print_name if missing
        if (
          !transformedData.print_name ||
          transformedData.print_name.trim() === ""
        ) {
          transformedData.print_name = transformedData.component_name;
        }

        // Validate status
        if (transformedData.status) {
          const validStatuses = ["active", "inactive"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            transformedData.status = "active"; // Default to active
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "active"; // Default to active
        }
        break;

      case "SalaryStructure":
        // Ensure structure_name is present
        if (
          !transformedData.structure_name ||
          transformedData.structure_name.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing structure_name for SalaryStructure, using default",
            metadata: {
              structure_id: transformedData.structure_id,
            },
          });
          transformedData.structure_name = `Structure ${transformedData.structure_id.substring(0, 8)}`;
        }

        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for SalaryStructure",
            metadata: {
              structure_id: transformedData.structure_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure structure_code is present
        if (
          !transformedData.structure_code ||
          transformedData.structure_code.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing structure_code for SalaryStructure, generating default",
            metadata: {
              structure_id: transformedData.structure_id,
            },
          });
          // Generate code from name if missing
          transformedData.structure_code = transformedData.structure_name
            .toLowerCase()
            .replace(/\s+/g, "_")
            .substring(0, 20); // Limit to 20 chars
        }

        // Format decimal values for min_ctc and max_ctc
        ["min_ctc", "max_ctc"].forEach((field) => {
          if (
            transformedData[field] !== null &&
            transformedData[field] !== undefined
          ) {
            if (typeof transformedData[field] === "string") {
              transformedData[field] = parseFloat(
                transformedData[field].replace(/[^\d.-]/g, "")
              );

              if (isNaN(transformedData[field])) {
                transformedData[field] = null;
              }
            }
          }
        });

        // Format date fields correctly
        ["effective_from", "effective_to"].forEach((field) => {
          if (transformedData[field]) {
            try {
              const date = new Date(transformedData[field]);
              if (!isNaN(date.getTime())) {
                transformedData[field] = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
              }
            } catch (error) {
              logger.warn({
                message: `Failed to format ${field} date for SalaryStructure`,
                metadata: {
                  structure_id: transformedData.structure_id,
                  value: transformedData[field],
                  error: error.message,
                },
              });

              // If effective_from is invalid, set to today
              if (field === "effective_from") {
                transformedData[field] = new Date().toISOString().split("T")[0]; // Default to today
              } else {
                transformedData[field] = null; // Other date fields can be null
              }
            }
          } else if (field === "effective_from") {
            // effective_from is required, set to today if missing
            transformedData[field] = new Date().toISOString().split("T")[0]; // Default to today
          }
        });

        // Ensure is_default is a boolean
        if (transformedData.is_default !== undefined) {
          transformedData.is_default = Boolean(transformedData.is_default);
        } else {
          transformedData.is_default = false; // Default value
        }

        // Validate status
        if (transformedData.status) {
          const validStatuses = ["active", "inactive"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            transformedData.status = "active"; // Default to active
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "active"; // Default to active
        }
        break;

      case "SalaryStructureComponent":
        // Ensure structure_id and component_id are present
        if (!transformedData.structure_id) {
          logger.error({
            message: "Missing structure_id for SalaryStructureComponent",
            metadata: {
              structure_component_id: transformedData.structure_component_id,
            },
          });
          return null; // Cannot proceed without structure_id
        }

        if (!transformedData.component_id) {
          logger.error({
            message: "Missing component_id for SalaryStructureComponent",
            metadata: {
              structure_component_id: transformedData.structure_component_id,
            },
          });
          return null; // Cannot proceed without component_id
        }

        // Ensure calculation_priority is a valid integer
        if (transformedData.calculation_priority !== undefined) {
          if (typeof transformedData.calculation_priority === "string") {
            transformedData.calculation_priority = parseInt(
              transformedData.calculation_priority
            );
          }

          if (isNaN(transformedData.calculation_priority)) {
            transformedData.calculation_priority = 0; // Default to 0
          }
        } else {
          transformedData.calculation_priority = 0; // Default if not provided
        }

        // Format decimal values correctly
        [
          "percentage_of_basic",
          "percentage_of_ctc",
          "min_value",
          "max_value",
          "default_value",
        ].forEach((field) => {
          if (
            transformedData[field] !== null &&
            transformedData[field] !== undefined
          ) {
            if (typeof transformedData[field] === "string") {
              transformedData[field] = parseFloat(
                transformedData[field].replace(/[^\d.-]/g, "")
              );

              if (isNaN(transformedData[field])) {
                transformedData[field] = null;
              }
            }
          }
        });

        // Ensure is_mandatory is a boolean
        if (transformedData.is_mandatory !== undefined) {
          transformedData.is_mandatory = Boolean(transformedData.is_mandatory);
        } else {
          transformedData.is_mandatory = true; // Default value
        }

        // Validate status
        if (transformedData.status) {
          const validStatuses = ["active", "inactive"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            transformedData.status = "active"; // Default to active
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "active"; // Default to active
        }
        break;

      case "EmployeeSalary":
        // Ensure employee_id and structure_id are present
        if (!transformedData.employee_id) {
          logger.error({
            message: "Missing employee_id for EmployeeSalary",
            metadata: {
              salary_id: transformedData.salary_id,
            },
          });
          return null; // Cannot proceed without employee_id
        }

        if (!transformedData.structure_id) {
          logger.error({
            message: "Missing structure_id for EmployeeSalary",
            metadata: {
              salary_id: transformedData.salary_id,
            },
          });
          return null; // Cannot proceed without structure_id
        }

        // Format date fields correctly
        ["effective_from", "effective_to"].forEach((field) => {
          if (transformedData[field]) {
            try {
              const date = new Date(transformedData[field]);
              if (!isNaN(date.getTime())) {
                transformedData[field] = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
              }
            } catch (error) {
              logger.warn({
                message: `Failed to format ${field} date for EmployeeSalary`,
                metadata: {
                  salary_id: transformedData.salary_id,
                  value: transformedData[field],
                  error: error.message,
                },
              });

              // If effective_from is invalid, set to today
              if (field === "effective_from") {
                transformedData[field] = new Date().toISOString().split("T")[0]; // Default to today
              } else {
                transformedData[field] = null; // Other date fields can be null
              }
            }
          } else if (field === "effective_from") {
            // effective_from is required, set to today if missing
            transformedData[field] = new Date().toISOString().split("T")[0]; // Default to today
          }
        });

        // Format decimal values
        ["annual_ctc", "monthly_ctc", "basic_percent", "hra_percent"].forEach(
          (field) => {
            if (
              transformedData[field] !== null &&
              transformedData[field] !== undefined
            ) {
              if (typeof transformedData[field] === "string") {
                transformedData[field] = parseFloat(
                  transformedData[field].replace(/[^\d.-]/g, "")
                );

                if (isNaN(transformedData[field])) {
                  if (field === "annual_ctc" || field === "monthly_ctc") {
                    transformedData[field] = 0; // Default to 0 for required fields
                  } else {
                    transformedData[field] = null; // null for optional fields
                  }
                }
              }
            } else if (field === "annual_ctc" || field === "monthly_ctc") {
              transformedData[field] = 0; // Default to 0 for required fields
            }
          }
        );

        // Validate revision_type if present
        if (transformedData.revision_type) {
          const validRevisionTypes = [
            "promotion",
            "annual",
            "performance",
            "adjustment",
            "other",
          ];
          if (
            !validRevisionTypes.includes(
              transformedData.revision_type.toLowerCase()
            )
          ) {
            transformedData.revision_type = null; // Set to null if invalid
          } else {
            transformedData.revision_type =
              transformedData.revision_type.toLowerCase();
          }
        }

        // Validate status
        if (transformedData.status) {
          const validStatuses = ["active", "inactive"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            transformedData.status = "active"; // Default to active
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "active"; // Default to active
        }
        break;

      case "PayrollCycle":
        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for PayrollCycle",
            metadata: {
              cycle_id: transformedData.cycle_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure cycle_name is present
        if (
          !transformedData.cycle_name ||
          transformedData.cycle_name.trim() === ""
        ) {
          logger.warn({
            message: "Missing cycle_name for PayrollCycle, using default",
            metadata: {
              cycle_id: transformedData.cycle_id,
            },
          });
          transformedData.cycle_name = `Cycle ${transformedData.cycle_id.substring(0, 8)}`;
        }

        // Ensure integer fields are valid
        ["start_day", "end_day", "processing_day", "payment_day"].forEach(
          (field) => {
            if (transformedData[field] !== undefined) {
              if (typeof transformedData[field] === "string") {
                transformedData[field] = parseInt(transformedData[field]);
              }

              if (isNaN(transformedData[field])) {
                // Use sensible defaults for missing or invalid values
                const defaults = {
                  start_day: 1,
                  end_day: 31,
                  processing_day: 25,
                  payment_day: 30,
                };

                transformedData[field] = defaults[field];

                logger.warn({
                  message: `Invalid ${field} for PayrollCycle, using default`,
                  metadata: {
                    cycle_id: transformedData.cycle_id,
                    provided_value: transformedData[field],
                    default_value: defaults[field],
                  },
                });
              }

              // Validate day values are in reasonable ranges
              if (
                field === "start_day" &&
                (transformedData[field] < 1 || transformedData[field] > 28)
              ) {
                transformedData[field] = 1; // Default start day to 1st of month
              }

              if (
                field === "end_day" &&
                (transformedData[field] < 28 || transformedData[field] > 31)
              ) {
                transformedData[field] = 31; // Default end day to 31st of month
              }

              if (
                (field === "processing_day" || field === "payment_day") &&
                (transformedData[field] < 1 || transformedData[field] > 31)
              ) {
                // Default to reasonable values
                transformedData[field] = field === "processing_day" ? 25 : 30;
              }
            } else {
              // Use sensible defaults for missing values
              const defaults = {
                start_day: 1,
                end_day: 31,
                processing_day: 25,
                payment_day: 30,
              };

              transformedData[field] = defaults[field];
            }
          }
        );

        // Ensure boolean fields
        ["consider_previous_month", "is_default"].forEach((field) => {
          transformedData[field] = Boolean(transformedData[field]);
        });

        // Validate status
        if (transformedData.status) {
          const validStatuses = ["active", "inactive"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            transformedData.status = "active"; // Default to active
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "active"; // Default to active
        }
        break;

      case "PayrollRun":
        // Ensure org_id and cycle_id are present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for PayrollRun",
            metadata: {
              run_id: transformedData.run_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        if (!transformedData.cycle_id) {
          logger.error({
            message: "Missing cycle_id for PayrollRun",
            metadata: {
              run_id: transformedData.run_id,
            },
          });
          return null; // Cannot proceed without cycle_id
        }

        // Format date fields correctly
        ["run_date", "start_date", "end_date"].forEach((field) => {
          if (transformedData[field]) {
            try {
              const date = new Date(transformedData[field]);
              if (!isNaN(date.getTime())) {
                transformedData[field] = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
              }
            } catch (error) {
              logger.warn({
                message: `Failed to format ${field} date for PayrollRun`,
                metadata: {
                  run_id: transformedData.run_id,
                  value: transformedData[field],
                  error: error.message,
                },
              });

              // Set to today if invalid
              transformedData[field] = new Date().toISOString().split("T")[0];
            }
          } else {
            // These fields are required, set to today if missing
            transformedData[field] = new Date().toISOString().split("T")[0];
          }
        });

        // Ensure integer fields
        if (transformedData.total_employees !== undefined) {
          if (typeof transformedData.total_employees === "string") {
            transformedData.total_employees = parseInt(
              transformedData.total_employees
            );
          }

          if (isNaN(transformedData.total_employees)) {
            transformedData.total_employees = 0;
          }
        } else {
          transformedData.total_employees = 0; // Default if not provided
        }

        // Format decimal values
        ["total_gross", "total_deductions", "total_net_pay"].forEach(
          (field) => {
            if (
              transformedData[field] !== null &&
              transformedData[field] !== undefined
            ) {
              if (typeof transformedData[field] === "string") {
                transformedData[field] = parseFloat(
                  transformedData[field].replace(/[^\d.-]/g, "")
                );

                if (isNaN(transformedData[field])) {
                  transformedData[field] = 0; // Default to 0 if invalid
                }
              }
            } else {
              transformedData[field] = 0; // Default to 0 if not provided
            }
          }
        );

        // Ensure locked is a boolean
        transformedData.locked = Boolean(transformedData.locked);

        // Validate payroll status
        if (transformedData.status) {
          const validPayrollStatuses = [
            "draft",
            "processing",
            "completed",
            "approved",
            "cancelled",
          ];
          if (
            !validPayrollStatuses.includes(transformedData.status.toLowerCase())
          ) {
            transformedData.status = "draft"; // Default to draft if invalid
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "draft"; // Default to draft if not provided
        }
        break;

      case "PolicyModule":
        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for PolicyModule",
            metadata: {
              module_id: transformedData.module_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure module_name is present
        if (
          !transformedData.module_name ||
          transformedData.module_name.trim() === ""
        ) {
          logger.warn({
            message: "Missing module_name for PolicyModule, using default",
            metadata: {
              module_id: transformedData.module_id,
            },
          });
          transformedData.module_name = `Policy ${transformedData.module_id.substring(0, 8)}`;
        }

        // Ensure module_code is present
        if (
          !transformedData.module_code ||
          transformedData.module_code.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing module_code for PolicyModule, generating from name",
            metadata: {
              module_id: transformedData.module_id,
            },
          });
          // Generate code from name if missing
          transformedData.module_code = transformedData.module_name
            .toLowerCase()
            .replace(/\s+/g, "_")
            .substring(0, 20); // Limit to 20 chars
        }

        // Validate module_category
        if (transformedData.module_category) {
          const validCategories = [
            "leave",
            "attendance",
            "payroll",
            "expense",
            "recruitment",
            "performance",
            "general",
          ];
          if (
            !validCategories.includes(
              transformedData.module_category.toLowerCase()
            )
          ) {
            logger.warn({
              message:
                "Invalid module_category for PolicyModule, using default",
              metadata: {
                module_id: transformedData.module_id,
                provided_category: transformedData.module_category,
              },
            });
            transformedData.module_category = "general"; // Default value
          } else {
            transformedData.module_category =
              transformedData.module_category.toLowerCase();
          }
        } else {
          transformedData.module_category = "general"; // Default if not provided
        }

        // Validate version format
        if (
          !transformedData.version ||
          !/^\d+\.\d+\.\d+$/.test(transformedData.version)
        ) {
          transformedData.version = "1.0.0"; // Default if missing or invalid
        }

        // Ensure is_mandatory is a boolean
        transformedData.is_mandatory = Boolean(transformedData.is_mandatory);

        // Format date fields correctly
        ["effective_from", "effective_to"].forEach((field) => {
          if (transformedData[field]) {
            try {
              const date = new Date(transformedData[field]);
              if (!isNaN(date.getTime())) {
                transformedData[field] = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
              }
            } catch (error) {
              logger.warn({
                message: `Failed to format ${field} date for PolicyModule`,
                metadata: {
                  module_id: transformedData.module_id,
                  value: transformedData[field],
                  error: error.message,
                },
              });

              // If effective_from is invalid, set to today
              if (field === "effective_from") {
                transformedData[field] = new Date().toISOString().split("T")[0]; // Default to today
              } else {
                transformedData[field] = null; // Other date fields can be null
              }
            }
          } else if (field === "effective_from") {
            // effective_from is required, set to today if missing
            transformedData[field] = new Date().toISOString().split("T")[0]; // Default to today
          }
        });

        // Validate policy status
        if (transformedData.status) {
          const validPolicyStatuses = [
            "draft",
            "active",
            "inactive",
            "archived",
          ];
          if (
            !validPolicyStatuses.includes(transformedData.status.toLowerCase())
          ) {
            transformedData.status = "draft"; // Default to draft if invalid
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "draft"; // Default to draft if not provided
        }
        break;

      case "PolicySetting":
        // Ensure module_id and org_id are present
        if (!transformedData.module_id) {
          logger.error({
            message: "Missing module_id for PolicySetting",
            metadata: {
              setting_id: transformedData.setting_id,
            },
          });
          return null; // Cannot proceed without module_id
        }

        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for PolicySetting",
            metadata: {
              setting_id: transformedData.setting_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure setting_name is present
        if (
          !transformedData.setting_name ||
          transformedData.setting_name.trim() === ""
        ) {
          logger.warn({
            message: "Missing setting_name for PolicySetting, using default",
            metadata: {
              setting_id: transformedData.setting_id,
            },
          });
          transformedData.setting_name = `Setting ${transformedData.setting_id.substring(0, 8)}`;
        }

        // Ensure setting_key is present
        if (
          !transformedData.setting_key ||
          transformedData.setting_key.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing setting_key for PolicySetting, generating from name",
            metadata: {
              setting_id: transformedData.setting_id,
            },
          });
          // Generate key from name if missing
          transformedData.setting_key = transformedData.setting_name
            .toLowerCase()
            .replace(/\s+/g, "_")
            .substring(0, 20); // Limit to 20 chars
        }

        // Validate and normalize setting_value format
        if (
          !transformedData.setting_value ||
          typeof transformedData.setting_value !== "object"
        ) {
          logger.warn({
            message:
              "Invalid setting_value format for PolicySetting, creating default",
            metadata: {
              setting_id: transformedData.setting_id,
            },
          });
          // Create default object structure
          transformedData.setting_value = { value: null };
        }

        // Validate setting_type
        if (transformedData.setting_type) {
          const validTypes = ["number", "string", "boolean", "object", "array"];
          if (
            !validTypes.includes(transformedData.setting_type.toLowerCase())
          ) {
            logger.warn({
              message: "Invalid setting_type for PolicySetting, using default",
              metadata: {
                setting_id: transformedData.setting_id,
                provided_type: transformedData.setting_type,
              },
            });
            transformedData.setting_type = "number"; // Default value
          } else {
            transformedData.setting_type =
              transformedData.setting_type.toLowerCase();
          }
        } else {
          transformedData.setting_type = "number"; // Default if not provided
        }

        // Ensure boolean fields
        ["is_encrypted", "is_configurable"].forEach((field) => {
          transformedData[field] = Boolean(transformedData[field]);
        });

        // Validate validation_rules format
        if (
          transformedData.validation_rules &&
          typeof transformedData.validation_rules !== "object"
        ) {
          try {
            // Try parsing if it's a JSON string
            if (typeof transformedData.validation_rules === "string") {
              transformedData.validation_rules = JSON.parse(
                transformedData.validation_rules
              );
            } else {
              transformedData.validation_rules = {}; // Default to empty object if invalid
            }
          } catch (error) {
            logger.warn({
              message:
                "Invalid validation_rules format for PolicySetting, using empty object",
              metadata: {
                setting_id: transformedData.setting_id,
                error: error.message,
              },
            });
            transformedData.validation_rules = {}; // Default to empty object if parsing fails
          }
        }

        // Validate default_value format
        if (
          transformedData.default_value &&
          typeof transformedData.default_value !== "object"
        ) {
          try {
            // Try parsing if it's a JSON string
            if (typeof transformedData.default_value === "string") {
              transformedData.default_value = JSON.parse(
                transformedData.default_value
              );
            } else {
              transformedData.default_value = { value: null }; // Default structure
            }
          } catch (error) {
            logger.warn({
              message:
                "Invalid default_value format for PolicySetting, using default structure",
              metadata: {
                setting_id: transformedData.setting_id,
                error: error.message,
              },
            });
            transformedData.default_value = { value: null }; // Default structure if parsing fails
          }
        }

        // Validate status
        if (transformedData.status) {
          const validStatuses = ["active", "inactive"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            transformedData.status = "active"; // Default to active
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "active"; // Default to active
        }
        break;

      case "SalaryStructureComponent":
        // Ensure structure_id and component_id are present
        if (!transformedData.structure_id) {
          logger.error({
            message: "Missing structure_id for SalaryStructureComponent",
            metadata: {
              structure_component_id: transformedData.structure_component_id,
            },
          });
          return null; // Cannot proceed without structure_id
        }

        if (!transformedData.component_id) {
          logger.error({
            message: "Missing component_id for SalaryStructureComponent",
            metadata: {
              structure_component_id: transformedData.structure_component_id,
              structure_id: transformedData.structure_id,
            },
          });
          return null; // Cannot proceed without component_id
        }

        // Ensure calculation_type has a valid value
        if (
          !transformedData.calculation_type ||
          !["fixed", "percentage"].includes(
            transformedData.calculation_type.toLowerCase()
          )
        ) {
          transformedData.calculation_type = "fixed"; // Default to fixed
        }

        // Convert calculation_type to lowercase
        transformedData.calculation_type =
          transformedData.calculation_type.toLowerCase();

        // Ensure value is a number
        if (
          transformedData.value === undefined ||
          transformedData.value === null
        ) {
          transformedData.value = 0;
        } else if (typeof transformedData.value === "string") {
          transformedData.value = parseFloat(
            transformedData.value.replace(/[^\d.-]/g, "")
          );
          if (isNaN(transformedData.value)) {
            transformedData.value = 0;
          }
        }
        break;

      case "EmployeeSalary":
        // Ensure employee_id is present
        if (!transformedData.employee_id) {
          logger.error({
            message: "Missing employee_id for EmployeeSalary",
            metadata: {
              salary_id: transformedData.salary_id,
            },
          });
          return null; // Cannot proceed without employee_id
        }

        // Ensure structure_id is present
        if (!transformedData.structure_id) {
          logger.error({
            message: "Missing structure_id for EmployeeSalary",
            metadata: {
              salary_id: transformedData.salary_id,
              employee_id: transformedData.employee_id,
            },
          });
          return null; // Cannot proceed without structure_id
        }

        // Format currency values
        ["amount", "gross_amount", "net_amount"].forEach((field) => {
          if (transformedData[field] !== undefined) {
            // Convert string values to numbers if needed
            if (typeof transformedData[field] === "string") {
              transformedData[field] = parseFloat(
                transformedData[field].replace(/[^\d.-]/g, "")
              );
            }

            // Ensure it's a valid number
            if (isNaN(transformedData[field])) {
              transformedData[field] = 0;
            }
          }
        });

        // Ensure effective_from is a valid date
        if (!transformedData.effective_from) {
          transformedData.effective_from = new Date()
            .toISOString()
            .split("T")[0]; // Default to today
        }
        break;

      /* Removed duplicate PayrollCycle case - using enhanced version above */

      /* Removed duplicate PayrollRun case - using enhanced version above */

      /* Removed duplicate PolicyModule case - using enhanced version above */

      /* Removed duplicate PolicySetting case - using enhanced version above */

      case "ProbationPolicy":
        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for ProbationPolicy",
            metadata: {
              policy_id: transformedData.policy_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure probation_code is present and valid
        if (
          !transformedData.probation_code ||
          transformedData.probation_code.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing probation_code for ProbationPolicy, generating default",
            metadata: {
              policy_id: transformedData.policy_id,
            },
          });
          // Generate a default code
          transformedData.probation_code = `PROB_${new Date().getTime().toString().substring(5, 13)}`;
        }

        // Format integer fields
        [
          "probation_period_months",
          "min_extension_months",
          "max_extension_months",
          "max_extensions",
          "notice_period_days",
          "review_before_days",
        ].forEach((field) => {
          if (transformedData[field] !== undefined) {
            if (typeof transformedData[field] === "string") {
              transformedData[field] = parseInt(transformedData[field]);
            }

            if (isNaN(transformedData[field])) {
              // Set default values for required fields if invalid
              const defaults = {
                probation_period_months: 3,
                min_extension_months: 1,
                max_extension_months: 3,
                max_extensions: 1,
                notice_period_days: 30,
                review_before_days: 15,
              };

              transformedData[field] = defaults[field];

              logger.warn({
                message: `Invalid ${field} for ProbationPolicy, using default value`,
                metadata: {
                  policy_id: transformedData.policy_id,
                  field: field,
                  value: transformedData[field],
                },
              });
            }
          } else if (["probation_period_months"].includes(field)) {
            // Required fields must have a value
            transformedData[field] =
              field === "probation_period_months" ? 3 : 0;
          }
        });

        // Ensure boolean fields are properly formatted
        ["extension_allowed", "auto_confirm", "review_required"].forEach(
          (field) => {
            transformedData[field] = Boolean(transformedData[field]);
          }
        );

        // Validate status
        if (transformedData.status) {
          const validStatuses = ["active", "inactive"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            transformedData.status = "active"; // Default to active
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "active"; // Default to active
        }
        break;

      case "PolicyDocumentVersion":
        // Ensure module_id is present
        if (!transformedData.module_id) {
          logger.error({
            message: "Missing module_id for PolicyDocumentVersion",
            metadata: {
              version_id: transformedData.version_id,
            },
          });
          return null; // Cannot proceed without module_id
        }

        // Ensure version_number is valid
        if (
          !transformedData.version_number ||
          !/^\d+\.\d+\.\d+$/.test(transformedData.version_number)
        ) {
          logger.warn({
            message:
              "Invalid version_number for PolicyDocumentVersion, using default",
            metadata: {
              version_id: transformedData.version_id,
            },
          });
          transformedData.version_number = "1.0.0"; // Default version
        }

        // Format date fields correctly
        ["effective_from", "effective_to", "approved_at"].forEach((field) => {
          if (transformedData[field]) {
            try {
              const date = new Date(transformedData[field]);
              if (!isNaN(date.getTime())) {
                // For 'approved_at', keep time component
                if (field === "approved_at") {
                  transformedData[field] = date.toISOString();
                } else {
                  // For other dates, format as YYYY-MM-DD
                  transformedData[field] = date.toISOString().split("T")[0];
                }
              }
            } catch (error) {
              logger.warn({
                message: `Failed to format ${field} date for PolicyDocumentVersion`,
                metadata: {
                  version_id: transformedData.version_id,
                  value: transformedData[field],
                  error: error.message,
                },
              });

              // If effective_from is invalid, set to today
              if (field === "effective_from") {
                transformedData[field] = new Date().toISOString().split("T")[0]; // Default to today
              } else {
                transformedData[field] = null; // Other date fields can be null
              }
            }
          } else if (field === "effective_from") {
            // effective_from is required, set to today if missing
            transformedData[field] = new Date().toISOString().split("T")[0]; // Default to today
          }
        });

        // Validate status
        if (transformedData.status) {
          const validStatuses = ["draft", "active", "inactive", "archived"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            transformedData.status = "draft"; // Default to draft
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "draft"; // Default to draft
        }
        break;

      case "PolicyAcknowledgment":
        // Ensure version_id and employee_id are present
        if (!transformedData.version_id) {
          logger.error({
            message: "Missing version_id for PolicyAcknowledgment",
            metadata: {
              acknowledgment_id: transformedData.acknowledgment_id,
            },
          });
          return null; // Cannot proceed without version_id
        }

        if (!transformedData.employee_id) {
          logger.error({
            message: "Missing employee_id for PolicyAcknowledgment",
            metadata: {
              acknowledgment_id: transformedData.acknowledgment_id,
            },
          });
          return null; // Cannot proceed without employee_id
        }

        // Format acknowledged_at date
        if (transformedData.acknowledged_at) {
          try {
            const date = new Date(transformedData.acknowledged_at);
            if (!isNaN(date.getTime())) {
              transformedData.acknowledged_at = date.toISOString();
            }
          } catch (error) {
            logger.warn({
              message:
                "Failed to format acknowledged_at date for PolicyAcknowledgment, using current time",
              metadata: {
                acknowledgment_id: transformedData.acknowledgment_id,
                value: transformedData.acknowledged_at,
                error: error.message,
              },
            });
            transformedData.acknowledged_at = new Date().toISOString(); // Default to now
          }
        } else {
          transformedData.acknowledged_at = new Date().toISOString(); // Default to now
        }

        // Validate acknowledgment_type
        if (transformedData.acknowledgment_type) {
          const validTypes = ["electronic", "manual", "verbal"];
          if (
            !validTypes.includes(
              transformedData.acknowledgment_type.toLowerCase()
            )
          ) {
            transformedData.acknowledgment_type = "electronic"; // Default to electronic
          } else {
            transformedData.acknowledgment_type =
              transformedData.acknowledgment_type.toLowerCase();
          }
        } else {
          transformedData.acknowledgment_type = "electronic"; // Default to electronic
        }
        break;

      case "LeavePolicyConfiguration":
        // Ensure org_id and module_id are present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for LeavePolicyConfiguration",
            metadata: {
              config_id: transformedData.config_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        if (!transformedData.module_id) {
          logger.error({
            message: "Missing module_id for LeavePolicyConfiguration",
            metadata: {
              config_id: transformedData.config_id,
            },
          });
          return null; // Cannot proceed without module_id
        }

        // Validate leave_type
        if (transformedData.leave_type) {
          const validLeaveTypes = [
            "annual",
            "sick",
            "causal",
            "maternity",
            "paternity",
            "unpaid",
            "compensatory",
            "other",
          ];
          if (
            !validLeaveTypes.includes(transformedData.leave_type.toLowerCase())
          ) {
            logger.warn({
              message:
                "Invalid leave_type for LeavePolicyConfiguration, using default",
              metadata: {
                config_id: transformedData.config_id,
                provided_type: transformedData.leave_type,
              },
            });
            transformedData.leave_type = "annual"; // Default value
          } else {
            transformedData.leave_type =
              transformedData.leave_type.toLowerCase();
          }
        } else {
          transformedData.leave_type = "annual"; // Default if not provided
        }

        // Validate accrual_frequency
        if (transformedData.accrual_frequency) {
          const validFrequencies = [
            "monthly",
            "quarterly",
            "biannual",
            "annual",
          ];
          if (
            !validFrequencies.includes(
              transformedData.accrual_frequency.toLowerCase()
            )
          ) {
            logger.warn({
              message:
                "Invalid accrual_frequency for LeavePolicyConfiguration, using default",
              metadata: {
                config_id: transformedData.config_id,
                provided_frequency: transformedData.accrual_frequency,
              },
            });
            transformedData.accrual_frequency = "monthly"; // Default value
          } else {
            transformedData.accrual_frequency =
              transformedData.accrual_frequency.toLowerCase();
          }
        } else {
          transformedData.accrual_frequency = "monthly"; // Default if not provided
        }

        // Format days_per_year as decimal
        if (transformedData.days_per_year !== undefined) {
          if (typeof transformedData.days_per_year === "string") {
            transformedData.days_per_year = parseFloat(
              transformedData.days_per_year.replace(/[^\d.-]/g, "")
            );
          }

          if (isNaN(transformedData.days_per_year)) {
            transformedData.days_per_year = 12; // Default to 12 days per year
          }
        } else {
          transformedData.days_per_year = 12; // Default if not provided
        }

        // Format integer fields
        [
          "min_days_per_request",
          "max_days_per_request",
          "min_notice_days",
          "max_carry_forward_days",
          "carry_forward_validity_months",
          "encashment_limit",
          "document_submission_days",
          "applicable_from_months",
        ].forEach((field) => {
          if (transformedData[field] !== undefined) {
            if (typeof transformedData[field] === "string") {
              transformedData[field] = parseInt(transformedData[field]);
            }

            if (isNaN(transformedData[field])) {
              // Set default values for required fields if invalid
              const defaults = {
                min_days_per_request: 1,
                max_days_per_request: 5,
                min_notice_days: 1,
                max_carry_forward_days: 0,
                carry_forward_validity_months: 12,
                encashment_limit: 0,
                document_submission_days: 0,
                applicable_from_months: 0,
              };

              transformedData[field] = defaults[field];
            }
          }
        });

        // Ensure boolean fields
        [
          "is_encashable",
          "requires_approval",
          "requires_documents",
          "prorata_basis",
        ].forEach((field) => {
          transformedData[field] = Boolean(transformedData[field]);
        });

        // Validate status
        if (transformedData.status) {
          const validStatuses = ["active", "inactive"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            transformedData.status = "active"; // Default to active
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "active"; // Default to active
        }
        break;

      case "HolidayCalendarYear":
        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for HolidayCalendarYear",
            metadata: {
              calendar_id: transformedData.calendar_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure year is a valid integer
        if (transformedData.year) {
          if (typeof transformedData.year === "string") {
            transformedData.year = parseInt(transformedData.year);
          }

          if (
            isNaN(transformedData.year) ||
            transformedData.year < 2000 ||
            transformedData.year > 2100
          ) {
            // Use current year if invalid
            const currentYear = new Date().getFullYear();
            logger.warn({
              message: `Invalid year for HolidayCalendarYear, using current year ${currentYear}`,
              metadata: {
                calendar_id: transformedData.calendar_id,
                provided_year: transformedData.year,
              },
            });
            transformedData.year = currentYear;
          }
        } else {
          // Default to current year
          transformedData.year = new Date().getFullYear();
        }

        // Format date fields correctly
        ["start_date", "end_date"].forEach((field) => {
          if (transformedData[field]) {
            try {
              const date = new Date(transformedData[field]);
              if (!isNaN(date.getTime())) {
                transformedData[field] = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
              }
            } catch (error) {
              logger.warn({
                message: `Failed to format ${field} date for HolidayCalendarYear`,
                metadata: {
                  calendar_id: transformedData.calendar_id,
                  value: transformedData[field],
                  error: error.message,
                },
              });
            }
          }
        });

        // Set default dates if missing or invalid
        if (!transformedData.start_date) {
          transformedData.start_date = `${transformedData.year}-01-01`; // January 1st
        }

        if (!transformedData.end_date) {
          transformedData.end_date = `${transformedData.year}-12-31`; // December 31st
        }

        // Validate status
        if (transformedData.status) {
          const validStatuses = ["active", "inactive"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            transformedData.status = "active"; // Default to active
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "active"; // Default to active
        }
        break;

      case "HolidayMaster":
        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for HolidayMaster",
            metadata: {
              holiday_id: transformedData.holiday_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure holiday_name is present
        if (
          !transformedData.holiday_name ||
          transformedData.holiday_name.trim() === ""
        ) {
          logger.warn({
            message: "Missing holiday_name for HolidayMaster, using default",
            metadata: {
              holiday_id: transformedData.holiday_id,
            },
          });
          transformedData.holiday_name = `Holiday ${transformedData.holiday_id.substring(0, 8)}`;
        }

        // Validate holiday_type
        if (transformedData.holiday_type) {
          const validTypes = ["public", "optional", "restricted", "company"];
          if (
            !validTypes.includes(transformedData.holiday_type.toLowerCase())
          ) {
            logger.warn({
              message: "Invalid holiday_type for HolidayMaster, using default",
              metadata: {
                holiday_id: transformedData.holiday_id,
                provided_type: transformedData.holiday_type,
              },
            });
            transformedData.holiday_type = "public"; // Default value
          } else {
            transformedData.holiday_type =
              transformedData.holiday_type.toLowerCase();
          }
        } else {
          transformedData.holiday_type = "public"; // Default value
        }

        // Validate recurrence_type
        if (transformedData.recurrence_type) {
          const validRecurrenceTypes = [
            "yearly_fixed_date",
            "yearly_variable_date",
            "one_time",
            "custom",
          ];
          if (
            !validRecurrenceTypes.includes(
              transformedData.recurrence_type.toLowerCase()
            )
          ) {
            logger.warn({
              message:
                "Invalid recurrence_type for HolidayMaster, using default",
              metadata: {
                holiday_id: transformedData.holiday_id,
                provided_type: transformedData.recurrence_type,
              },
            });
            transformedData.recurrence_type = "yearly_fixed_date"; // Default value
          } else {
            transformedData.recurrence_type =
              transformedData.recurrence_type.toLowerCase();
          }
        } else {
          transformedData.recurrence_type = "yearly_fixed_date"; // Default value
        }
        break;

      case "HolidayCalendarDetail":
        // Ensure calendar_id and holiday_id are present
        if (!transformedData.calendar_id) {
          logger.error({
            message: "Missing calendar_id for HolidayCalendarDetail",
            metadata: {
              calendar_detail_id: transformedData.calendar_detail_id,
            },
          });
          return null; // Cannot proceed without calendar_id
        }

        if (!transformedData.holiday_id) {
          logger.error({
            message: "Missing holiday_id for HolidayCalendarDetail",
            metadata: {
              calendar_detail_id: transformedData.calendar_detail_id,
              calendar_id: transformedData.calendar_id,
            },
          });
          return null; // Cannot proceed without holiday_id
        }

        // Format holiday_date correctly
        if (transformedData.holiday_date) {
          try {
            const date = new Date(transformedData.holiday_date);
            if (!isNaN(date.getTime())) {
              transformedData.holiday_date = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
            }
          } catch (error) {
            logger.warn({
              message:
                "Failed to format holiday_date for HolidayCalendarDetail, using current date",
              metadata: {
                calendar_detail_id: transformedData.calendar_detail_id,
                value: transformedData.holiday_date,
                error: error.message,
              },
            });
            transformedData.holiday_date = new Date()
              .toISOString()
              .split("T")[0]; // Default to today
          }
        } else {
          transformedData.holiday_date = new Date().toISOString().split("T")[0]; // Default to today
        }

        // Ensure is_half_day is a boolean
        transformedData.is_half_day = Boolean(transformedData.is_half_day);

        // Validate half_day_type if is_half_day is true
        if (
          transformedData.is_half_day === true &&
          transformedData.half_day_type
        ) {
          const validHalfDayTypes = ["first_half", "second_half"];
          if (
            !validHalfDayTypes.includes(
              transformedData.half_day_type.toLowerCase()
            )
          ) {
            logger.warn({
              message:
                "Invalid half_day_type for HolidayCalendarDetail, using default",
              metadata: {
                calendar_detail_id: transformedData.calendar_detail_id,
                provided_type: transformedData.half_day_type,
              },
            });
            transformedData.half_day_type = "first_half"; // Default value
          } else {
            transformedData.half_day_type =
              transformedData.half_day_type.toLowerCase();
          }
        } else if (transformedData.is_half_day === false) {
          transformedData.half_day_type = null; // Clear half_day_type if not a half day
        }
        break;

      case "AttendanceSettings":
        // Map organizationId to org_id if needed
        if (transformedData.organizationId && !transformedData.org_id) {
          transformedData.org_id = transformedData.organizationId;
        }

        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for AttendanceSettings",
            metadata: {
              id: transformedData.id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure moduleId is present
        if (!transformedData.moduleId && !transformedData.module_id) {
          logger.error({
            message: "Missing moduleId for AttendanceSettings",
            metadata: {
              id: transformedData.id,
              org_id: transformedData.org_id,
            },
          });
          return null; // Cannot proceed without moduleId
        }

        // Map moduleId to module_id if needed
        if (transformedData.moduleId && !transformedData.module_id) {
          transformedData.module_id = transformedData.moduleId;
        }

        // Format array fields
        if (transformedData.captureMethods) {
          // Ensure captureMethods is an array of lowercase strings
          if (typeof transformedData.captureMethods === "string") {
            try {
              transformedData.captureMethods = JSON.parse(
                transformedData.captureMethods
              );
            } catch (error) {
              transformedData.captureMethods = [transformedData.captureMethods];
            }
          }

          if (!Array.isArray(transformedData.captureMethods)) {
            transformedData.captureMethods = ["web_app"]; // Default if not an array
          } else {
            const validMethods = [
              "web_app",
              "mobile_app",
              "biometric",
              "kiosk",
              "rfid",
            ];
            transformedData.captureMethods = transformedData.captureMethods
              .filter(
                (method) =>
                  typeof method === "string" &&
                  validMethods.includes(method.toLowerCase())
              )
              .map((method) => method.toLowerCase());

            if (transformedData.captureMethods.length === 0) {
              transformedData.captureMethods = ["web_app"]; // Default if all were invalid
            }
          }
        } else {
          transformedData.captureMethods = ["web_app"]; // Default if not provided
        }

        // Ensure boolean fields
        [
          "geoFencingEnabled",
          "overtimePolicyEnabled",
          "autoCheckoutEnabled",
          "regularizationAllowed",
        ].forEach((field) => {
          transformedData[field] = Boolean(transformedData[field]);
        });

        // Format integer fields
        [
          "geoFenceRadius",
          "gracePeriodMinutes",
          "halfDayHours",
          "breakDurationMinutes",
          "workDaysPerWeek",
          "minimumOvertimeMinutes",
          "maxOvertimeHoursMonthly",
          "regularizationWindowDays",
          "regularizationLimitMonthly",
        ].forEach((field) => {
          if (
            transformedData[field] !== undefined &&
            transformedData[field] !== null
          ) {
            if (typeof transformedData[field] === "string") {
              transformedData[field] = parseInt(transformedData[field]);
            }

            if (isNaN(transformedData[field])) {
              // Set default values based on field name
              const defaults = {
                geoFenceRadius: 500,
                gracePeriodMinutes: 15,
                halfDayHours: 4,
                breakDurationMinutes: 60,
                workDaysPerWeek: 5,
                minimumOvertimeMinutes: 30,
                maxOvertimeHoursMonthly: 40,
                regularizationWindowDays: 7,
                regularizationLimitMonthly: 3,
              };

              transformedData[field] = defaults[field] || 0;
            }
          }
        });

        // Format decimal fields
        [
          "fullDayHours",
          "weekendOvertimeMultiplier",
          "holidayOvertimeMultiplier",
        ].forEach((field) => {
          if (
            transformedData[field] !== undefined &&
            transformedData[field] !== null
          ) {
            if (typeof transformedData[field] === "string") {
              transformedData[field] = parseFloat(
                transformedData[field].replace(/[^\d.-]/g, "")
              );
            }

            if (isNaN(transformedData[field])) {
              // Set default values based on field name
              const defaults = {
                fullDayHours: 8,
                weekendOvertimeMultiplier: 1.5,
                holidayOvertimeMultiplier: 2.0,
              };

              transformedData[field] = defaults[field] || 0;
            }
          }
        });

        // Validate shiftType
        if (transformedData.shiftType) {
          const validShiftTypes = ["fixed", "flexible", "hybrid"];
          if (
            !validShiftTypes.includes(transformedData.shiftType.toLowerCase())
          ) {
            transformedData.shiftType = "fixed"; // Default to fixed
          } else {
            transformedData.shiftType = transformedData.shiftType.toLowerCase();
          }
        } else {
          transformedData.shiftType = "fixed"; // Default to fixed
        }

        // Format time fields
        ["shift_start_time", "shift_end_time", "auto_checkout_time"].forEach(
          (field) => {
            if (transformedData[field]) {
              try {
                const date = new Date(transformedData[field]);
                if (!isNaN(date.getTime())) {
                  // Format as time only (HH:MM:SS)
                  transformedData[field] = date.toTimeString().split(" ")[0];
                }
              } catch (error) {
                logger.warn({
                  message: `Failed to format ${field} for AttendanceSettings`,
                  metadata: {
                    id: transformedData.id,
                    value: transformedData[field],
                    error: error.message,
                  },
                });
              }
            }
          }
        );

        // Validate latePenaltyType
        if (transformedData.latePenaltyType) {
          const validPenaltyTypes = ["none", "deduction", "leave"];
          if (
            !validPenaltyTypes.includes(
              transformedData.latePenaltyType.toLowerCase()
            )
          ) {
            transformedData.latePenaltyType = "none"; // Default to none
          } else {
            transformedData.latePenaltyType =
              transformedData.latePenaltyType.toLowerCase();
          }
        } else {
          transformedData.latePenaltyType = "none"; // Default to none
        }

        // Validate latePenaltyLeaveType if penalty type is leave
        if (
          transformedData.latePenaltyType === "leave" &&
          transformedData.latePenaltyLeaveType
        ) {
          const validLeaveTypes = ["casual", "sick", "annual", "unpaid"];
          if (
            !validLeaveTypes.includes(
              transformedData.latePenaltyLeaveType.toLowerCase()
            )
          ) {
            transformedData.latePenaltyLeaveType = "casual"; // Default value
          } else {
            transformedData.latePenaltyLeaveType =
              transformedData.latePenaltyLeaveType.toLowerCase();
          }
        } else if (transformedData.latePenaltyType !== "leave") {
          transformedData.latePenaltyLeaveType = null; // Clear if not using leave penalty
        }

        // Validate overtimeCalculationType
        if (transformedData.overtimeCalculationType) {
          const validOvertimeTypes = ["daily", "weekly", "monthly"];
          if (
            !validOvertimeTypes.includes(
              transformedData.overtimeCalculationType.toLowerCase()
            )
          ) {
            transformedData.overtimeCalculationType = "daily"; // Default to daily
          } else {
            transformedData.overtimeCalculationType =
              transformedData.overtimeCalculationType.toLowerCase();
          }
        }

        // Validate missingSwipePolicy
        if (transformedData.missingSwipePolicy) {
          const validPolicies = ["automatic", "manual", "none"];
          if (
            !validPolicies.includes(
              transformedData.missingSwipePolicy.toLowerCase()
            )
          ) {
            transformedData.missingSwipePolicy = "automatic"; // Default to automatic
          } else {
            transformedData.missingSwipePolicy =
              transformedData.missingSwipePolicy.toLowerCase();
          }
        } else {
          transformedData.missingSwipePolicy = "automatic"; // Default to automatic
        }

        // Validate status
        if (transformedData.status) {
          const validStatuses = ["active", "inactive"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            transformedData.status = "active"; // Default to active
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "active"; // Default to active
        }
        break;

      case "ShiftConfiguration":
        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for ShiftConfiguration",
            metadata: {
              shift_id: transformedData.shift_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure shift_name is present
        if (
          !transformedData.shift_name ||
          transformedData.shift_name.trim() === ""
        ) {
          logger.warn({
            message: "Missing shift_name for ShiftConfiguration, using default",
            metadata: {
              shift_id: transformedData.shift_id,
            },
          });
          transformedData.shift_name = `Shift ${transformedData.shift_id.substring(0, 8)}`;
        }

        // Validate shift_type
        if (transformedData.shift_type) {
          const validShiftTypes = ["fixed", "flexible", "hybrid", "rotational"];
          if (
            !validShiftTypes.includes(transformedData.shift_type.toLowerCase())
          ) {
            logger.warn({
              message:
                "Invalid shift_type for ShiftConfiguration, using default",
              metadata: {
                shift_id: transformedData.shift_id,
                provided_type: transformedData.shift_type,
              },
            });
            transformedData.shift_type = "fixed"; // Default value
          } else {
            transformedData.shift_type =
              transformedData.shift_type.toLowerCase();
          }
        } else {
          transformedData.shift_type = "fixed"; // Default value
        }

        // Format time fields
        ["start_time", "end_time"].forEach((field) => {
          if (transformedData[field]) {
            try {
              const date = new Date(transformedData[field]);
              if (!isNaN(date.getTime())) {
                // Format as time only (HH:MM:SS)
                transformedData[field] = date.toTimeString().split(" ")[0];
              }
            } catch (error) {
              logger.warn({
                message: `Failed to format ${field} for ShiftConfiguration`,
                metadata: {
                  shift_id: transformedData.shift_id,
                  value: transformedData[field],
                  error: error.message,
                },
              });
            }
          }
        });

        // Format integer fields
        ["flexible_hours", "break_duration", "grace_period_minutes"].forEach(
          (field) => {
            if (transformedData[field] !== undefined) {
              if (typeof transformedData[field] === "string") {
                transformedData[field] = parseInt(transformedData[field]);
              }

              if (isNaN(transformedData[field])) {
                // Set default values for required fields if invalid
                const defaults = {
                  flexible_hours: 0,
                  break_duration: 60,
                  grace_period_minutes: 15,
                };

                transformedData[field] = defaults[field];
              }
            }
          }
        );

        // Format decimal fields
        ["half_day_hours", "full_day_hours"].forEach((field) => {
          if (transformedData[field] !== undefined) {
            if (typeof transformedData[field] === "string") {
              transformedData[field] = parseFloat(
                transformedData[field].replace(/[^\d.-]/g, "")
              );
            }

            if (isNaN(transformedData[field])) {
              // Set default values based on field name
              const defaults = {
                half_day_hours: 4,
                full_day_hours: 8,
              };

              transformedData[field] = defaults[field];
            }
          }
        });

        // Validate status
        if (transformedData.status) {
          const validStatuses = ["active", "inactive"];
          if (!validStatuses.includes(transformedData.status.toLowerCase())) {
            transformedData.status = "active"; // Default to active
          } else {
            transformedData.status = transformedData.status.toLowerCase();
          }
        } else {
          transformedData.status = "active"; // Default to active
        }
        break;

      case "EmployeeShiftAssignment":
        // Ensure employee_id and shift_id are present
        if (!transformedData.employee_id) {
          logger.error({
            message: "Missing employee_id for EmployeeShiftAssignment",
            metadata: {
              assignment_id: transformedData.assignment_id,
            },
          });
          return null; // Cannot proceed without employee_id
        }

        if (!transformedData.shift_id) {
          logger.error({
            message: "Missing shift_id for EmployeeShiftAssignment",
            metadata: {
              assignment_id: transformedData.assignment_id,
              employee_id: transformedData.employee_id,
            },
          });
          return null; // Cannot proceed without shift_id
        }

        // Format date fields correctly
        ["effective_from", "effective_to"].forEach((field) => {
          if (transformedData[field]) {
            try {
              const date = new Date(transformedData[field]);
              if (!isNaN(date.getTime())) {
                transformedData[field] = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
              }
            } catch (error) {
              logger.warn({
                message: `Failed to format ${field} date for EmployeeShiftAssignment`,
                metadata: {
                  assignment_id: transformedData.assignment_id,
                  value: transformedData[field],
                  error: error.message,
                },
              });

              // For effective_from, default to today if invalid
              if (field === "effective_from") {
                transformedData[field] = new Date().toISOString().split("T")[0];
              }
            }
          } else if (field === "effective_from") {
            // effective_from is required, so default to today if missing
            transformedData[field] = new Date().toISOString().split("T")[0];
          }
        });
        break;

      case "OrganizationLocation":
        // Ensure org_id is present
        if (!transformedData.org_id && transformedData.organizationId) {
          // Map organizationId to org_id if needed
          transformedData.org_id = transformedData.organizationId;
        }

        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for OrganizationLocation",
            metadata: {
              location_id: transformedData.location_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure location_name is present
        if (
          !transformedData.location_name ||
          transformedData.location_name.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing location_name for OrganizationLocation, using default",
            metadata: {
              location_id: transformedData.location_id,
            },
          });
          transformedData.location_name = `Location ${transformedData.location_id.substring(0, 8)}`;
        }

        // Ensure location_code is present
        if (
          !transformedData.location_code ||
          transformedData.location_code.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing location_code for OrganizationLocation, using default",
            metadata: {
              location_id: transformedData.location_id,
            },
          });
          transformedData.location_code = `LOC${transformedData.location_id.substring(0, 5)}`;
        }

        // Ensure address_line1 is present
        if (
          !transformedData.address_line1 ||
          transformedData.address_line1.trim() === ""
        ) {
          logger.warn({
            message:
              "Missing address_line1 for OrganizationLocation, using default",
            metadata: {
              location_id: transformedData.location_id,
            },
          });
          transformedData.address_line1 = `Address for ${transformedData.location_name}`;
        }

        // Ensure city is present
        if (!transformedData.city || transformedData.city.trim() === "") {
          logger.warn({
            message: "Missing city for OrganizationLocation, using default",
            metadata: {
              location_id: transformedData.location_id,
            },
          });
          transformedData.city = "Unknown City";
        }

        // Ensure country_id is present
        if (!transformedData.country_id) {
          logger.error({
            message: "Missing country_id for OrganizationLocation",
            metadata: {
              location_id: transformedData.location_id,
            },
          });
          return null; // Cannot proceed without country_id
        }

        // Ensure state_id is present
        if (!transformedData.state_id) {
          logger.error({
            message: "Missing state_id for OrganizationLocation",
            metadata: {
              location_id: transformedData.location_id,
            },
          });
          return null; // Cannot proceed without state_id
        }

        // Ensure pincode is present and in string format
        if (
          transformedData.pincode === undefined ||
          transformedData.pincode === null
        ) {
          logger.warn({
            message: "Missing pincode for OrganizationLocation, using default",
            metadata: {
              location_id: transformedData.location_id,
            },
          });
          transformedData.pincode = "000000";
        } else if (typeof transformedData.pincode === "number") {
          // Convert pincode to string if it's a number
          transformedData.pincode = transformedData.pincode.toString();
        }

        // Ensure timezone is present
        if (
          !transformedData.timezone ||
          transformedData.timezone.trim() === ""
        ) {
          transformedData.timezone = "Asia/Kolkata"; // Default timezone
        }

        // Ensure boolean fields are properly set
        ["is_head_office", "is_registered_office", "is_branch"].forEach(
          (field) => {
            if (transformedData[field] !== undefined) {
              transformedData[field] = Boolean(transformedData[field]);
            }
          }
        );

        // Ensure status field has a valid value
        if (
          !transformedData.status ||
          !["active", "inactive"].includes(transformedData.status.toLowerCase())
        ) {
          transformedData.status = "active";
        }

        // Convert status to lowercase
        transformedData.status = transformedData.status.toLowerCase();
        break;

      case "DepartmentType":
        // Ensure type_name is present
        if (
          !transformedData.type_name ||
          transformedData.type_name.trim() === ""
        ) {
          logger.warn({
            message: "Missing type_name for DepartmentType, using default",
            metadata: {
              dept_type_id: transformedData.dept_type_id,
            },
          });
          transformedData.type_name = `Department Type ${transformedData.dept_type_id.substring(0, 8)}`;
        }

        // Ensure type_code is present
        if (
          !transformedData.type_code ||
          transformedData.type_code.trim() === ""
        ) {
          logger.warn({
            message: "Missing type_code for DepartmentType, using default",
            metadata: {
              dept_type_id: transformedData.dept_type_id,
            },
          });
          transformedData.type_code = `DT${transformedData.dept_type_id.substring(0, 3)}`;
        }

        // Ensure is_active is a boolean
        if (transformedData.is_active !== undefined) {
          transformedData.is_active = Boolean(transformedData.is_active);
        } else {
          transformedData.is_active = true; // Default value
        }
        break;

      case "Department":
        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for Department",
            metadata: {
              dept_id: transformedData.dept_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure dept_code is present
        if (
          !transformedData.dept_code ||
          transformedData.dept_code.trim() === ""
        ) {
          logger.warn({
            message: "Missing dept_code for Department, using default",
            metadata: {
              dept_id: transformedData.dept_id,
            },
          });
          transformedData.dept_code = `DEPT${transformedData.dept_id.substring(0, 5)}`;
        }

        // Ensure dept_name is present
        if (
          !transformedData.dept_name ||
          transformedData.dept_name.trim() === ""
        ) {
          logger.warn({
            message: "Missing dept_name for Department, using default",
            metadata: {
              dept_id: transformedData.dept_id,
            },
          });
          transformedData.dept_name = `Department ${transformedData.dept_id.substring(0, 8)}`;
        }

        // Ensure status field has a valid value
        if (
          !transformedData.status ||
          !["active", "inactive"].includes(transformedData.status.toLowerCase())
        ) {
          transformedData.status = "active";
        }

        // Convert status to lowercase
        transformedData.status = transformedData.status.toLowerCase();
        break;

      case "EmploymentType":
        // Ensure type_name is present and valid
        const validEmploymentTypes = [
          "permanent",
          "contract",
          "probation",
          "intern",
          "part_time",
          "consultant",
        ];
        if (
          !transformedData.type_name ||
          !validEmploymentTypes.includes(
            transformedData.type_name.toLowerCase()
          )
        ) {
          logger.warn({
            message:
              "Invalid or missing type_name for EmploymentType, using default",
            metadata: {
              employment_type_id: transformedData.employment_type_id,
              provided_type: transformedData.type_name,
            },
          });
          transformedData.type_name = "permanent"; // Default to permanent
        }

        // Convert type_name to lowercase
        transformedData.type_name = transformedData.type_name.toLowerCase();

        // Ensure type_code is present
        if (
          !transformedData.type_code ||
          transformedData.type_code.trim() === ""
        ) {
          logger.warn({
            message: "Missing type_code for EmploymentType, using default",
            metadata: {
              employment_type_id: transformedData.employment_type_id,
            },
          });
          transformedData.type_code = `ET${transformedData.employment_type_id.substring(0, 3)}`;
        }
        break;

      case "JobTitle":
        // Ensure org_id is present
        if (!transformedData.org_id) {
          logger.error({
            message: "Missing org_id for JobTitle",
            metadata: {
              job_title_id: transformedData.job_title_id,
            },
          });
          return null; // Cannot proceed without org_id
        }

        // Ensure title_name is present
        if (
          !transformedData.title_name ||
          transformedData.title_name.trim() === ""
        ) {
          logger.warn({
            message: "Missing title_name for JobTitle, using default",
            metadata: {
              job_title_id: transformedData.job_title_id,
            },
          });
          transformedData.title_name = `Job Title ${transformedData.job_title_id.substring(0, 8)}`;
        }

        // Ensure title_code is present
        if (
          !transformedData.title_code ||
          transformedData.title_code.trim() === ""
        ) {
          logger.warn({
            message: "Missing title_code for JobTitle, using default",
            metadata: {
              job_title_id: transformedData.job_title_id,
            },
          });
          transformedData.title_code = `JT${transformedData.job_title_id.substring(0, 3)}`;
        }

        // Ensure grade_level is a number if present
        if (
          transformedData.grade_level !== undefined &&
          transformedData.grade_level !== null
        ) {
          if (typeof transformedData.grade_level === "string") {
            transformedData.grade_level = parseInt(
              transformedData.grade_level,
              10
            );
            if (isNaN(transformedData.grade_level)) {
              transformedData.grade_level = null;
            }
          }
        }
        break;

      case "ShiftConfiguration":
        // Ensure proper formatting for shift times
        ["startTime", "endTime", "breakStartTime", "breakEndTime"].forEach(
          (timeField) => {
            if (
              transformedData[timeField] &&
              typeof transformedData[timeField] === "string"
            ) {
              // Ensure time format is correct (HH:MM:SS)
              if (!/^\d{2}:\d{2}(:\d{2})?$/.test(transformedData[timeField])) {
                try {
                  // Try to parse and format the time
                  const timeDate = new Date(
                    `1970-01-01T${transformedData[timeField]}`
                  );
                  if (!isNaN(timeDate.getTime())) {
                    transformedData[timeField] = timeDate
                      .toTimeString()
                      .split(" ")[0];
                  }
                } catch (error) {
                  logger.warn({
                    message: `Failed to format time field ${timeField}`,
                    metadata: {
                      value: transformedData[timeField],
                      error: error.message,
                    },
                  });
                }
              }
            }
          }
        );
        break;

      // Handle employee-related objects
      case "Employee":
      case "EmployeePersonalDetail":
      case "EmployeeBankDetail":
      case "EmployeeFinancialDetail":
      case "EmployeeSalary":
        // For employee objects, ensure numeric values are properly typed
        Object.keys(transformedData).forEach((key) => {
          if (
            typeof transformedData[key] === "string" &&
            (key.toLowerCase().includes("amount") ||
              key.toLowerCase().includes("salary") ||
              key.toLowerCase().includes("rate") ||
              key.toLowerCase().includes("value"))
          ) {
            // Convert numeric strings to numbers
            const numValue = parseFloat(transformedData[key]);
            if (!isNaN(numValue)) {
              transformedData[key] = numValue;
            }
          }
        });
        break;

      // Handle salary-related objects
      case "SalaryStructure":
      case "SalaryStructureComponent":
      case "SalaryComponentMaster":
        // Ensure numeric values are properly formatted
        Object.keys(transformedData).forEach((key) => {
          if (
            typeof transformedData[key] === "string" &&
            (key.toLowerCase().includes("amount") ||
              key.toLowerCase().includes("percentage") ||
              key.toLowerCase().includes("value"))
          ) {
            // Convert numeric strings to numbers
            const numValue = parseFloat(transformedData[key]);
            if (!isNaN(numValue)) {
              transformedData[key] = numValue;
            }
          }
        });
        break;

      // Handle policy-related objects
      case "PolicyModule":
      case "PolicySetting":
      case "ProbationPolicy":
      case "LeavePolicyConfiguration":
        // Convert boolean strings to actual booleans
        Object.keys(transformedData).forEach((key) => {
          if (
            typeof transformedData[key] === "string" &&
            (transformedData[key].toLowerCase() === "true" ||
              transformedData[key].toLowerCase() === "false")
          ) {
            transformedData[key] =
              transformedData[key].toLowerCase() === "true";
          }
        });
        break;
    }

    return transformedData;
  }

  /**
   * Close connections and perform cleanup
   */
  async close() {
    try {
      // Close the RabbitMQ connection if it exists
      if (mqService.connection) {
        await mqService.close();
        logger.info({
          message: "Consumer connections closed successfully",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error({
        message: "Error closing consumer connections",
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
}

module.exports = new ConsumePassedData();
