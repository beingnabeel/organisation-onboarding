const axios = require("axios");
const mqService = require("./mqService");
const validationService = require("./validationService");
const { logger } = require("../utils/logger");

class ConsumePassedData {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
    this.processedObjectsCache = [];
    this.schemaMap = {
      // Map object properties to their corresponding schema/table
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
      employee_id: "Employee",
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
      policy_id: "ProbationPolicy",
      version_id: "PolicyDocumentVersion",
      acknowledgment_id: "PolicyAcknowledgment",
      config_id: "LeavePolicyConfiguration",
      calendar_id: "HolidayCalendarYear",
      holiday_id: "HolidayMaster",
      calendar_detail_id: "HolidayCalendarDetail",
      id: "AttendanceSettings",
      shift_id: "ShiftConfiguration",
      assignment_id: "EmployeeShiftAssignment",
    };
    this.apiEndpoints = {
      Organization: "/api/v1/tenant-onboarding/organizations",
      BankMaster: "/api/v1/tenant-onboarding/banks",
      OrganizationBankDetail: "/api/v1/tenant-onboarding/organization-bank-details",
      OrganizationTaxDetail: "/api/v1/tenant-onboarding/organization-tax-details",
      OrganizationComplianceDetail: "/api/v1/tenant-onboarding/organization-compliance-details",
      CountryMaster: "/api/v1/tenant-onboarding/countries",
      StateMaster: "/api/v1/tenant-onboarding/states",
      OrganizationLocation: "/api/v1/tenant-onboarding/organization-locations",
      DepartmentType: "/api/v1/tenant-onboarding/department-types",
      Department: "/api/v1/tenant-onboarding/departments",
      EmploymentType: "/api/v1/tenant-onboarding/employment-types",
      JobTitle: "/api/v1/tenant-onboarding/job-titles",
      Employee: "/api/v1/tenant-onboarding/employees",
      EmployeePersonalDetail: "/api/v1/tenant-onboarding/employee-personal-details",
      EmployeeBankDetail: "/api/v1/tenant-onboarding/employee-bank-details",
      EmployeeFinancialDetail: "/api/v1/tenant-onboarding/employee-financial-details",
      SalaryComponentMaster: "/api/v1/tenant-onboarding/salary-components",
      SalaryStructure: "/api/v1/tenant-onboarding/salary-structures",
      SalaryStructureComponent: "/api/v1/tenant-onboarding/salary-structure-components",
      EmployeeSalary: "/api/v1/tenant-onboarding/employee-salaries",
      PayrollCycle: "/api/v1/tenant-onboarding/payroll-cycles",
      PayrollRun: "/api/v1/tenant-onboarding/payroll-runs",
      PolicyModule: "/api/v1/tenant-onboarding/policy-modules",
      PolicySetting: "/api/v1/tenant-onboarding/policy-settings",
      ProbationPolicy: "/api/v1/tenant-onboarding/probation-policies",
      PolicyDocumentVersion: "/api/v1/tenant-onboarding/policy-document-versions",
      PolicyAcknowledgment: "/api/v1/tenant-onboarding/policy-acknowledgments",
      LeavePolicyConfiguration: "/api/v1/tenant-onboarding/leave-policy-configurations",
      HolidayCalendarYear: "/api/v1/tenant-onboarding/holiday-calendar-years",
      HolidayMaster: "/api/v1/tenant-onboarding/holiday-masters",
      HolidayCalendarDetail: "/api/v1/tenant-onboarding/holiday-calendar-details",
      AttendanceSettings: "/api/v1/tenant-onboarding/attendance-settings",
      ShiftConfiguration: "/api/v1/tenant-onboarding/shift-configurations",
      EmployeeShiftAssignment: "/api/v1/tenant-onboarding/employee-shift-assignments",
    };
    this.baseURL = process.env.API_BASE_URL || "http://localhost:8085";
  }

  /**
   * Start consuming messages from the passed_data queue
   */
  async startConsumer() {
    try {
      logger.info({
        message: "Starting consumer for passed_data queue",
        timestamp: new Date().toISOString(),
      });

      // Connect to RabbitMQ
      const channel = await mqService.connect();

      // Set prefetch to 1 to process one message at a time
      await channel.prefetch(1);

      // Start consuming from the queue
      await channel.consume(
        mqService.passedQueue,
        async (msg) => {
          if (!msg) return;

          try {
            // Clear the cache for a new processing session
            this.processedObjectsCache = [];

            // Parse the message content
            const content = JSON.parse(msg.content.toString());
            logger.info({
              message: "Received message from passed_data queue",
              metadata: {
                messageId: msg.properties.messageId,
                timestamp: new Date().toISOString(),
              },
            });

            // Process the message
            await this.processMessage(content);

            // Acknowledge the message if processing was successful
            channel.ack(msg);
            logger.info({
              message: "Message processed successfully and acknowledged",
              metadata: {
                messageId: msg.properties.messageId,
                timestamp: new Date().toISOString(),
              },
            });
          } catch (error) {
            // Acknowledge the message even if processing failed - we don't want to retry automatically
            // as we handle retries within our processMessage function
            channel.ack(msg);
            logger.error({
              message: "Failed to process message",
              metadata: {
                error: {
                  message: error.message,
                  stack: error.stack,
                },
                messageId: msg.properties.messageId,
                timestamp: new Date().toISOString(),
              },
            });

            // Publish failed message to the failed queue
            await mqService.publishToFailed(
              JSON.parse(msg.content.toString()),
              error.message
            );
          }
        },
        { noAck: false }
      );

      logger.info({
        message: "Consumer setup completed for passed_data queue",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({
        message: "Failed to start consumer",
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
  }

  /**
   * Process a message and insert it into the appropriate database table
   * @param {Object} data - The data object from the message
   */
  async processMessage(data) {
    // Identify which schema the object belongs to
    const schemaName = this.identifySchema(data);

    if (!schemaName) {
      throw new Error(
        `Unable to determine schema for object: ${JSON.stringify(data)}`
      );
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

    // Insert the data into the database with retry logic
    await this.insertWithRetry(data, schemaName);
  }

  /**
   * Identify which schema an object belongs to based on its properties
   * @param {Object} data - The data object
   * @returns {string|null} - The schema name or null if not identified
   */
  identifySchema(data) {
    // Prioritize specific unique identifiers for each schema
    for (const [key, schema] of Object.entries(this.schemaMap)) {
      if (data.hasOwnProperty(key)) {
        // Additional checks for specific schemas to avoid misidentification
        switch (key) {
          case "bank_id":
            if (data.hasOwnProperty("bank_type")) {
              return schema;
            }
            break;
          case "org_id":
            if (data.hasOwnProperty("legal_entity_name")) {
              return schema;
            }
            break;
          case "org_bank_id":
            if (
              data.hasOwnProperty("org_id") &&
              data.hasOwnProperty("bank_id")
            ) {
              return schema;
            }
            break;
          case "org_tax_id":
            if (data.hasOwnProperty("org_id") && data.hasOwnProperty("pan")) {
              return schema;
            }
            break;
          case "org_compliance_id":
            if (
              data.hasOwnProperty("org_id") &&
              data.hasOwnProperty("compliance_code")
            ) {
              return schema;
            }
            break;
          case "country_id":
            if (data.hasOwnProperty("country_code")) {
              return schema;
            }
            break;
          case "state_id":
            if (
              data.hasOwnProperty("country_id") &&
              data.hasOwnProperty("state_code")
            ) {
              return schema;
            }
            break;
          case "location_id":
            if (
              data.hasOwnProperty("organizationId") ||
              data.hasOwnProperty("org_id")
            ) {
              return schema;
            }
            break;
          case "dept_type_id":
            if (
              data.hasOwnProperty("type_name") &&
              data.hasOwnProperty("type_code")
            ) {
              return schema;
            }
            break;
          case "dept_id":
            if (
              data.hasOwnProperty("dept_code") &&
              data.hasOwnProperty("dept_name")
            ) {
              return schema;
            }
            break;
          case "employment_type_id":
            if (
              data.hasOwnProperty("type_name") &&
              data.hasOwnProperty("type_code")
            ) {
              // Differentiate from DepartmentType by checking expected values
              if (
                typeof data.type_name === "string" &&
                [
                  "permanent",
                  "contract",
                  "internship",
                  "part_time",
                  "probation",
                ].includes(data.type_name.toLowerCase())
              ) {
                return schema;
              }
            }
            break;
          case "job_title_id":
            if (
              data.hasOwnProperty("title_name") &&
              data.hasOwnProperty("title_code")
            ) {
              return schema;
            }
            break;
          case "employee_id":
            if (
              data.hasOwnProperty("employee_number") &&
              (data.hasOwnProperty("first_name") ||
                data.hasOwnProperty("display_name"))
            ) {
              return schema;
            }
            break;
          case "empl_personal_det_id":
            if (
              data.hasOwnProperty("employee_id") &&
              (data.hasOwnProperty("marital_status") ||
                data.hasOwnProperty("father_name") ||
                data.hasOwnProperty("mother_name"))
            ) {
              return schema;
            }
            break;
          case "employee_bank_id":
            if (
              data.hasOwnProperty("employee_id") &&
              data.hasOwnProperty("account_number")
            ) {
              return schema;
            }
            break;
          case "empl_financial_id":
            if (
              data.hasOwnProperty("employee_id") &&
              (data.hasOwnProperty("salary_payment_mode") ||
                data.hasOwnProperty("pf_number") ||
                data.hasOwnProperty("pan_number"))
            ) {
              return schema;
            }
            break;
          case "component_id":
            if (
              data.hasOwnProperty("component_name") &&
              data.hasOwnProperty("component_code") &&
              data.hasOwnProperty("component_category")
            ) {
              return schema;
            }
            break;
          case "structure_id":
            if (
              data.hasOwnProperty("structure_name") &&
              data.hasOwnProperty("structure_code") &&
              data.hasOwnProperty("effective_from")
            ) {
              return schema;
            }
            break;
          case "structure_component_id":
            if (
              data.hasOwnProperty("structure_id") &&
              data.hasOwnProperty("component_id") &&
              data.hasOwnProperty("calculation_priority")
            ) {
              return schema;
            }
            break;
          case "salary_id":
            if (
              data.hasOwnProperty("employee_id") &&
              data.hasOwnProperty("structure_id") &&
              data.hasOwnProperty("annual_ctc")
            ) {
              return schema;
            }
            break;
          case "cycle_id":
            if (
              data.hasOwnProperty("org_id") &&
              data.hasOwnProperty("cycle_name") &&
              data.hasOwnProperty("start_day") &&
              data.hasOwnProperty("end_day")
            ) {
              return schema;
            }
            break;
          case "run_id":
            if (
              data.hasOwnProperty("org_id") &&
              data.hasOwnProperty("cycle_id") &&
              data.hasOwnProperty("run_date")
            ) {
              return schema;
            }
            break;
          case "module_id":
            if (
              data.hasOwnProperty("org_id") &&
              data.hasOwnProperty("module_name") &&
              data.hasOwnProperty("module_code")
            ) {
              return schema;
            }
            break;
          case "setting_id":
            if (
              data.hasOwnProperty("module_id") &&
              data.hasOwnProperty("setting_name") &&
              data.hasOwnProperty("setting_key") &&
              data.hasOwnProperty("setting_value")
            ) {
              return schema;
            }
            break;
          case "policy_id":
            if (
              data.hasOwnProperty("org_id") &&
              data.hasOwnProperty("probation_code") &&
              data.hasOwnProperty("probation_period_months")
            ) {
              return schema;
            }
            break;
          case "version_id":
            if (
              data.hasOwnProperty("module_id") &&
              data.hasOwnProperty("version_number") &&
              data.hasOwnProperty("effective_from")
            ) {
              return schema;
            }
            break;
          case "acknowledgment_id":
            if (
              data.hasOwnProperty("version_id") &&
              data.hasOwnProperty("employee_id") &&
              data.hasOwnProperty("acknowledged_at")
            ) {
              return schema;
            }
            break;
          case "config_id":
            if (
              data.hasOwnProperty("module_id") &&
              data.hasOwnProperty("org_id") &&
              data.hasOwnProperty("leave_type") &&
              data.hasOwnProperty("accrual_frequency")
            ) {
              return schema;
            }
            break;
          case "calendar_id":
            if (
              data.hasOwnProperty("org_id") &&
              data.hasOwnProperty("year") &&
              data.hasOwnProperty("start_date") &&
              data.hasOwnProperty("end_date")
            ) {
              return schema;
            }
            break;
          case "holiday_id":
            if (
              data.hasOwnProperty("org_id") &&
              data.hasOwnProperty("holiday_name") &&
              data.hasOwnProperty("holiday_type") &&
              data.hasOwnProperty("recurrence_type")
            ) {
              return schema;
            }
            break;
          case "calendar_detail_id":
            if (
              data.hasOwnProperty("calendar_id") &&
              data.hasOwnProperty("holiday_id") &&
              data.hasOwnProperty("holiday_date")
            ) {
              return schema;
            }
            break;
          case "id":
            if (
              data.hasOwnProperty("organizationId") &&
              data.hasOwnProperty("moduleId") &&
              data.hasOwnProperty("captureMethods")
            ) {
              return schema;
            }
            break;
          case "shift_id":
            if (
              data.hasOwnProperty("org_id") &&
              data.hasOwnProperty("shift_name") &&
              data.hasOwnProperty("shift_type")
            ) {
              return schema;
            }
            break;
          case "assignment_id":
            if (
              data.hasOwnProperty("employee_id") &&
              data.hasOwnProperty("shift_id") &&
              data.hasOwnProperty("effective_from")
            ) {
              return schema;
            }
            break;
          default:
            return schema;
        }
      }
    }

    // Special case for identifying schemas without primary key
    // These checks are for objects where the primary key might be missing (new objects)
    if (data.hasOwnProperty("type_name") && data.hasOwnProperty("type_code")) {
      if (
        data.hasOwnProperty("description") &&
        !data.hasOwnProperty("org_id")
      ) {
        if (
          typeof data.type_name === "string" &&
          [
            "permanent",
            "contract",
            "internship",
            "part_time",
            "probation",
          ].includes(data.type_name.toLowerCase())
        ) {
          return "EmploymentType";
        } else {
          return "DepartmentType";
        }
      }
    }

    if (
      data.hasOwnProperty("component_name") &&
      data.hasOwnProperty("component_code") &&
      data.hasOwnProperty("component_category")
    ) {
      return "SalaryComponentMaster";
    }

    // Identify SalaryStructure without primary key
    if (
      data.hasOwnProperty("structure_name") &&
      data.hasOwnProperty("structure_code") &&
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("effective_from")
    ) {
      return "SalaryStructure";
    }

    // Identify SalaryStructureComponent without primary key
    if (
      data.hasOwnProperty("structure_id") &&
      data.hasOwnProperty("component_id") &&
      data.hasOwnProperty("calculation_priority")
    ) {
      return "SalaryStructureComponent";
    }

    // Identify EmployeeSalary without primary key
    if (
      data.hasOwnProperty("employee_id") &&
      data.hasOwnProperty("structure_id") &&
      data.hasOwnProperty("annual_ctc") &&
      data.hasOwnProperty("monthly_ctc")
    ) {
      return "EmployeeSalary";
    }

    // Identify PayrollCycle without primary key
    if (
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("cycle_name") &&
      data.hasOwnProperty("start_day") &&
      data.hasOwnProperty("end_day") &&
      data.hasOwnProperty("processing_day")
    ) {
      return "PayrollCycle";
    }

    // Identify PayrollRun without primary key
    if (
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("cycle_id") &&
      data.hasOwnProperty("run_date") &&
      data.hasOwnProperty("start_date") &&
      data.hasOwnProperty("end_date")
    ) {
      return "PayrollRun";
    }

    // Identify PolicyModule without primary key
    if (
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("module_name") &&
      data.hasOwnProperty("module_code") &&
      data.hasOwnProperty("module_category")
    ) {
      return "PolicyModule";
    }

    // Identify PolicySetting without primary key
    if (
      data.hasOwnProperty("module_id") &&
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("setting_name") &&
      data.hasOwnProperty("setting_key") &&
      data.hasOwnProperty("setting_value")
    ) {
      return "PolicySetting";
    }

    // Identify ProbationPolicy without primary key
    if (
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("probation_code") &&
      data.hasOwnProperty("probation_period_months") &&
      data.hasOwnProperty("extension_allowed")
    ) {
      return "ProbationPolicy";
    }

    // Identify PolicyDocumentVersion without primary key
    if (
      data.hasOwnProperty("module_id") &&
      data.hasOwnProperty("version_number") &&
      data.hasOwnProperty("effective_from") &&
      data.hasOwnProperty("document_url")
    ) {
      return "PolicyDocumentVersion";
    }

    // Identify PolicyAcknowledgment without primary key
    if (
      data.hasOwnProperty("version_id") &&
      data.hasOwnProperty("employee_id") &&
      data.hasOwnProperty("acknowledged_at") &&
      data.hasOwnProperty("acknowledgment_type")
    ) {
      return "PolicyAcknowledgment";
    }

    // Identify LeavePolicyConfiguration without primary key
    if (
      data.hasOwnProperty("module_id") &&
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("leave_type") &&
      data.hasOwnProperty("accrual_frequency") &&
      data.hasOwnProperty("days_per_year")
    ) {
      return "LeavePolicyConfiguration";
    }

    // Identify HolidayCalendarYear without primary key
    if (
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("year") &&
      data.hasOwnProperty("start_date") &&
      data.hasOwnProperty("end_date")
    ) {
      return "HolidayCalendarYear";
    }

    // Identify HolidayMaster without primary key
    if (
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("holiday_name") &&
      data.hasOwnProperty("holiday_type") &&
      data.hasOwnProperty("recurrence_type")
    ) {
      return "HolidayMaster";
    }

    // Identify HolidayCalendarDetail without primary key
    if (
      data.hasOwnProperty("calendar_id") &&
      data.hasOwnProperty("holiday_id") &&
      data.hasOwnProperty("holiday_date")
    ) {
      return "HolidayCalendarDetail";
    }

    // Identify AttendanceSettings without primary key
    if (
      data.hasOwnProperty("organizationId") &&
      data.hasOwnProperty("moduleId") &&
      data.hasOwnProperty("captureMethods") &&
      data.hasOwnProperty("shiftType")
    ) {
      return "AttendanceSettings";
    }

    // Identify ShiftConfiguration without primary key
    if (
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("shift_name") &&
      data.hasOwnProperty("shift_type") &&
      (data.hasOwnProperty("start_time") ||
        data.hasOwnProperty("flexible_hours"))
    ) {
      return "ShiftConfiguration";
    }

    // Identify EmployeeShiftAssignment without primary key
    if (
      data.hasOwnProperty("employee_id") &&
      data.hasOwnProperty("shift_id") &&
      data.hasOwnProperty("effective_from")
    ) {
      return "EmployeeShiftAssignment";
    }

    // Fallback to validationService for more sophisticated identification
    const objectType = validationService.determineObjectType(data);
    if (objectType) {
      return objectType;
    }

    return null;
  }

  /**
   * Get the primary key value for an object
   * @param {Object} data - The data object
   * @param {string} schemaName - The identified schema name
   * @returns {string} - The primary key value
   */
  getPrimaryKeyValue(data, schemaName) {
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
      ProbationPolicy: "policy_id",
      PolicyDocumentVersion: "version_id",
      PolicyAcknowledgment: "acknowledgment_id",
      LeavePolicyConfiguration: "config_id",
      HolidayCalendarYear: "calendar_id",
      HolidayMaster: "holiday_id",
      HolidayCalendarDetail: "calendar_detail_id",
      AttendanceSettings: "id",
      ShiftConfiguration: "shift_id",
      EmployeeShiftAssignment: "assignment_id",
    };

    return data[primaryKeyMap[schemaName]];
  }

  /**
   * Insert data into the database with retry logic
   * @param {Object} data - The data object
   * @param {string} schemaName - The identified schema name
   */
  async insertWithRetry(data, schemaName, attempt = 1) {
    try {
      // Attempt to insert the data
      const endpoint = this.apiEndpoints[schemaName];
      const url = `${this.baseURL}${endpoint}`;

      logger.info({
        message: `Inserting ${schemaName} into database (attempt ${attempt}/${this.maxRetries})`,
        metadata: {
          endpoint,
          objectId: this.getPrimaryKeyValue(data, schemaName),
          timestamp: new Date().toISOString(),
        },
      });

      const response = await axios.post(url, data, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      // If successful, add to cache
      this.addToCache(data, schemaName, response.data);

      logger.info({
        message: `Successfully inserted ${schemaName} into database`,
        metadata: {
          objectId: this.getPrimaryKeyValue(data, schemaName),
          responseStatus: response.status,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error({
        message: `Failed to insert ${schemaName} (attempt ${attempt}/${this.maxRetries})`,
        metadata: {
          error: {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
          },
          objectId: this.getPrimaryKeyValue(data, schemaName),
          timestamp: new Date().toISOString(),
        },
      });

      // If we haven't reached the maximum number of retries, try again
      if (attempt < this.maxRetries) {
        logger.info({
          message: `Retrying insertion of ${schemaName} (attempt ${attempt + 1}/${this.maxRetries})`,
          metadata: {
            objectId: this.getPrimaryKeyValue(data, schemaName),
            timestamp: new Date().toISOString(),
          },
        });

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        return this.insertWithRetry(data, schemaName, attempt + 1);
      } else {
        // If we've exhausted all retries, perform rollback and throw an error
        logger.error({
          message: `All insertion attempts failed for ${schemaName}, initiating rollback`,
          metadata: {
            objectId: this.getPrimaryKeyValue(data, schemaName),
            timestamp: new Date().toISOString(),
          },
        });

        await this.performRollback();
        throw new Error(
          `Failed to insert ${schemaName} after ${this.maxRetries} attempts. Rollback completed.`
        );
      }
    }
  }

  /**
   * Add a successfully processed object to the cache
   * @param {Object} data - The original data object
   * @param {string} schemaName - The schema name
   * @param {Object} responseData - The response data from the API
   */
  addToCache(data, schemaName, responseData) {
    const cacheEntry = {
      data,
      schemaName,
      primaryKey: this.getPrimaryKeyValue(data, schemaName),
      endpoint: this.apiEndpoints[schemaName],
      responseData,
      timestamp: new Date().toISOString(),
    };

    this.processedObjectsCache.push(cacheEntry);

    logger.info({
      message: `Added ${schemaName} to cache for potential rollback`,
      metadata: {
        objectId: cacheEntry.primaryKey,
        cacheSize: this.processedObjectsCache.length,
        timestamp: cacheEntry.timestamp,
      },
    });
  }

  /**
   * Perform a rollback by deleting all previously inserted objects in reverse order
   */
  async performRollback() {
    logger.info({
      message: "Starting rollback operation",
      metadata: {
        cacheSize: this.processedObjectsCache.length,
        timestamp: new Date().toISOString(),
      },
    });

    // Process in reverse order to handle dependencies properly
    const reversedCache = [...this.processedObjectsCache].reverse();

    for (const cacheEntry of reversedCache) {
      try {
        const { schemaName, primaryKey, endpoint } = cacheEntry;
        const url = `${this.baseURL}${endpoint}/${primaryKey}`;

        logger.info({
          message: `Rolling back ${schemaName}`,
          metadata: {
            objectId: primaryKey,
            timestamp: new Date().toISOString(),
          },
        });

        // Delete the object
        await axios.delete(url, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        logger.info({
          message: `Successfully rolled back ${schemaName}`,
          metadata: {
            objectId: primaryKey,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        logger.error({
          message: `Failed to roll back ${cacheEntry.schemaName}`,
          metadata: {
            error: {
              message: error.message,
              status: error.response?.status,
              data: error.response?.data,
            },
            objectId: cacheEntry.primaryKey,
            timestamp: new Date().toISOString(),
          },
        });
        // Continue with rollback even if one deletion fails
      }
    }

    // Clear the cache after rollback
    this.processedObjectsCache = [];

    logger.info({
      message: "Rollback operation completed",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Stop the consumer
   */
  async stopConsumer() {
    try {
      await mqService.close();
      logger.info({
        message: "Consumer stopped for passed_data queue",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({
        message: "Error stopping consumer",
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
          },
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Close method - alias for stopConsumer for backward compatibility
   */
  async close() {
    logger.info({
      message: "Close method called, delegating to stopConsumer",
      timestamp: new Date().toISOString(),
    });
    return this.stopConsumer();
  }
}

module.exports = new ConsumePassedData();
