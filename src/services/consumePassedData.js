///    CONSUME PASSED_DATA FILE

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

    // Track deferred entities that are waiting for dependencies
    this.deferredEmployees = [];
    this.deferredEmployeePersonalDetails = [];
    this.deferredEmployeeBankDetails = [];
    this.deferredEmployeeFinancialDetails = [];
    this.deferredEmployeeSalaries = [];
    this.deferredPayrollRuns = [];
    this.deferredPolicyModules = [];
    this.deferredPolicySettings = [];
    this.deferredProbationPolicies = [];
    this.deferredVersions = [];
    this.deferredAcknowledgments = [];
    this.deferredEmployeeShiftAssignments = [];
    this.deferredAttendanceSettings = []; // Adding deferred array for AttendanceSettings
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
      OrganizationBankDetail:
        "/api/v1/tenant-onboarding/organization-bank-details",
      OrganizationTaxDetail:
        "/api/v1/tenant-onboarding/organization-tax-details",
      OrganizationComplianceDetail:
        "/api/v1/tenant-onboarding/organization-compliance-details",
      CountryMaster: "/api/v1/tenant-onboarding/countries",
      StateMaster: "/api/v1/tenant-onboarding/states",
      OrganizationLocation: "/api/v1/tenant-onboarding/organization-locations",
      DepartmentType: "/api/v1/tenant-onboarding/department-types",
      Department: "/api/v1/tenant-onboarding/departments",
      EmploymentType: "/api/v1/tenant-onboarding/employment-types",
      JobTitle: "/api/v1/tenant-onboarding/job-titles",
      Employee: "/api/v1/tenant-onboarding/employees",
      EmployeePersonalDetail:
        "/api/v1/tenant-onboarding/employee-personal-details",
      EmployeeBankDetail: "/api/v1/tenant-onboarding/employee-bank-details",
      EmployeeFinancialDetail:
        "/api/v1/tenant-onboarding/employee-financial-details",
      SalaryComponentMaster: "/api/v1/tenant-onboarding/salary-components",
      SalaryStructure: "/api/v1/tenant-onboarding/salary-structures",
      SalaryStructureComponent:
        "/api/v1/tenant-onboarding/salary-structure-components",
      EmployeeSalary: "/api/v1/tenant-onboarding/employee-salaries",
      PayrollCycle: "/api/v1/tenant-onboarding/payroll-cycles",
      PayrollRun: "/api/v1/tenant-onboarding/payroll-runs",
      PolicyModule: "/api/v1/tenant-onboarding/policy-modules",
      PolicySetting: "/api/v1/tenant-onboarding/policy-settings",
      ProbationPolicy: "/api/v1/tenant-onboarding/probation-policies",
      PolicyDocumentVersion:
        "/api/v1/tenant-onboarding/policy-document-versions",
      PolicyAcknowledgment: "/api/v1/tenant-onboarding/policy-acknowledgments",
      LeavePolicyConfiguration:
        "/api/v1/tenant-onboarding/leave-policy-configurations",
      HolidayCalendarYear: "/api/v1/tenant-onboarding/holiday-calendar-years",
      HolidayMaster: "/api/v1/tenant-onboarding/holiday-masters",
      HolidayCalendarDetail:
        "/api/v1/tenant-onboarding/holiday-calendar-details",
      AttendanceSettings: "/api/v1/tenant-onboarding/attendance-settings",
      ShiftConfiguration: "/api/v1/tenant-onboarding/shift-configurations",
      EmployeeShiftAssignment:
        "/api/v1/tenant-onboarding/employee-shift-assignments",
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

            // Initialize deferred items for this message batch
            this.deferredPolicyAcknowledgments = [];
            this.deferredPolicyDocumentVersions = [];
            this.deferredProbationPolicies = [];
            this.deferredPolicySettings = [];
            this.deferredLeavePolicyConfigurations = [];
            this.deferredAttendanceSettings = [];

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

            // Process any deferred items that might still be pending
            // This handles cases where the referenced records came after the dependent records
            if (
              (this.deferredPolicyDocumentVersions &&
                this.deferredPolicyDocumentVersions.length > 0) ||
              (this.deferredPolicySettings &&
                this.deferredPolicySettings.length > 0) ||
              (this.deferredProbationPolicies &&
                this.deferredProbationPolicies.length > 0) ||
              (this.deferredPolicyAcknowledgments &&
                this.deferredPolicyAcknowledgments.length > 0)
            ) {
              logger.info({
                message: `Processing remaining deferred items after message completion`,
                metadata: {
                  deferredVersionsCount:
                    this.deferredPolicyDocumentVersions.length,
                  deferredPolicySettingsCount:
                    this.deferredPolicySettings.length,
                  deferredProbationPoliciesCount:
                    this.deferredProbationPolicies.length,
                  deferredAcknowledgmentsCount:
                    this.deferredPolicyAcknowledgments.length,
                  timestamp: new Date().toISOString(),
                },
              });

              // Process in the correct order to handle dependencies
              await this.processDeferred();
            }

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
    // Initialize deferred items arrays if not already created
    if (!this.deferredPolicyAcknowledgments) {
      this.deferredPolicyAcknowledgments = [];
    }
    if (!this.deferredPolicyDocumentVersions) {
      this.deferredPolicyDocumentVersions = [];
    }
    if (!this.deferredProbationPolicies) {
      this.deferredProbationPolicies = [];
    }
    if (!this.deferredPolicySettings) {
      this.deferredPolicySettings = [];
    }
    if (!this.deferredPolicyModules) {
      this.deferredPolicyModules = [];
    }

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

    // Special handling for employee records to ensure dependencies are met
    if (schemaName === "Employee") {
      // Map department_id to dept_id if needed (to match schema)
      // if (data.department_id && !data.dept_id) {
      //   data.dept_id = data.department_id;
      //   delete data.department_id; // Remove non-schema field
      //   logger.debug({
      //     message: `Mapped department_id to dept_id for Employee record`,
      //     metadata: {
      //       employee_id: data.employee_id,
      //       dept_id: data.dept_id,
      //       timestamp: new Date().toISOString(),
      //     },
      //   });
      // }

      // Format date fields for initial employee record processing
      // data = this.formatEmployeeDateFields(data);

      // Validate required foreign keys exist
      const canProcess = await this.validateEmployeeForeignKeys(data);

      if (!canProcess) {
        logger.info({
          message: `Employee record requires dependencies, deferring for later processing`,
          metadata: {
            employee_id: data.employee_id,
            employee_number: data.employee_number,
            org_id: data.org_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Initialize deferred employees array if not already done
        if (!this.deferredEmployees) {
          this.deferredEmployees = [];
        }

        // Add to deferred employees queue instead of immediate insertion
        this.deferredEmployees.push({
          data,
          schemaName,
          attempt: 1,
        });

        return; // Skip direct insertion
      } else {
        logger.info({
          message: `All dependencies for Employee record are met, proceeding with insertion`,
          metadata: {
            employee_id: data.employee_id,
            employee_number: data.employee_number,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Insert the data into the database with retry logic
    await this.insertWithRetry(data, schemaName);

    // After processing the main message, try to process any deferred objects based on dependencies
    // Process PolicyDocumentVersions and PolicySettings after PolicyModule objects
    if (schemaName === "PolicyModule") {
      if (this.deferredPolicyDocumentVersions.length > 0) {
        logger.info({
          message: `Processing deferred PolicyDocumentVersions after PolicyModule insertion`,
          metadata: {
            moduleId: data.module_id,
            timestamp: new Date().toISOString(),
          },
        });
        await this.processDeferredVersions();
      }

      if (this.deferredPolicySettings.length > 0) {
        logger.info({
          message: `Processing deferred PolicySettings after PolicyModule insertion`,
          metadata: {
            moduleId: data.module_id,
            timestamp: new Date().toISOString(),
          },
        });
        await this.processDeferredPolicySettings();
      }
    }

    // Process deferred employees after Organization objects
    // Process employee-related objects in the specific order after foundation objects
    if (
      [
        "Organization",
        "BankMaster",
        "CountryMaster",
        "StateMaster",
        "OrganizationBankDetail",
        "OrganizationTaxDetail",
        "OrganizationComplianceDetail",
      ].includes(schemaName)
    ) {
      // Check if we have deferred employee-related objects waiting
      if (
        this.deferredEmployees.length > 0 ||
        this.deferredEmployeePersonalDetails.length > 0 ||
        this.deferredEmployeeBankDetails.length > 0 ||
        this.deferredEmployeeFinancialDetails.length > 0
      ) {
        logger.info({
          message: `Foundation object ${schemaName} inserted, processing employee objects in specified order`,
          metadata: {
            foundationObject: schemaName,
            foundationId: this.getPrimaryKeyValue(data, schemaName),
            deferredEmployees: this.deferredEmployees.length,
            deferredPersonalDetails:
              this.deferredEmployeePersonalDetails.length,
            deferredBankDetails: this.deferredEmployeeBankDetails.length,
            deferredFinancialDetails:
              this.deferredEmployeeFinancialDetails.length,
            timestamp: new Date().toISOString(),
          },
        });

        // Process in the exact order specified
        await this.processDeferredEmployees();
        await this.processDeferredEmployeePersonalDetails();
        await this.processDeferredEmployeeBankDetails();
        await this.processDeferredEmployeeFinancialDetails();
        await this.processDeferredEmployeeSalaries();
      }
    }

    // When an Employee is processed, try to process its details immediately
    if (schemaName === "Employee") {
      // Process employee details in exact order
      logger.info({
        message: `Employee inserted, processing any deferred employee detail objects`,
        metadata: {
          employeeId: data.employee_id,
          timestamp: new Date().toISOString(),
        },
      });

      await this.processDeferredEmployeePersonalDetails();
      await this.processDeferredEmployeeBankDetails();
      await this.processDeferredEmployeeFinancialDetails();
      await this.processDeferredEmployeeSalaries();
    }

    // Process ProbationPolicy objects after Employee objects
    if (
      schemaName === "Employee" &&
      this.deferredProbationPolicies.length > 0
    ) {
      logger.info({
        message: `Processing deferred ProbationPolicies after Employee insertion`,
        metadata: {
          employeeId: data.employee_id,
          timestamp: new Date().toISOString(),
        },
      });
      await this.processDeferredProbationPolicies();
    }

    // Process PolicyAcknowledgments after PolicyDocumentVersion objects
    if (
      schemaName === "PolicyDocumentVersion" &&
      this.deferredPolicyAcknowledgments.length > 0
    ) {
      logger.info({
        message: `Processing deferred PolicyAcknowledgments after PolicyDocumentVersion insertion`,
        metadata: {
          versionId: data.version_id,
          timestamp: new Date().toISOString(),
        },
      });
      await this.processDeferredAcknowledgments();
    }
  }

  /**
   * Process deferred PolicyAcknowledgment objects that were waiting for their referenced PolicyDocumentVersion
   */
  async processDeferredAcknowledgments() {
    if (
      !this.deferredPolicyAcknowledgments ||
      this.deferredPolicyAcknowledgments.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredPolicyAcknowledgments.length} deferred PolicyAcknowledgment objects`,
      timestamp: new Date().toISOString(),
    });

    // Process each deferred item
    const deferredItems = [...this.deferredPolicyAcknowledgments];
    this.deferredPolicyAcknowledgments = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred PolicyAcknowledgment (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            acknowledgment_id: item.data.acknowledgment_id,
            version_id: item.data.version_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        logger.error({
          message: `Failed to process deferred PolicyAcknowledgment`,
          metadata: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            acknowledgment_id: item.data.acknowledgment_id,
            version_id: item.data.version_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Publish to failed queue
        await mqService.publishToFailed(
          item.data,
          `Failed to process deferred PolicyAcknowledgment: ${error.message}`
        );
      }
    }
  }

  /**
   * Process deferred PolicyModule objects that were waiting for referenced Employees
   */
  async processDeferredPolicyModules() {
    if (
      !this.deferredPolicyModules ||
      this.deferredPolicyModules.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredPolicyModules.length} deferred PolicyModule objects`,
      timestamp: new Date().toISOString(),
    });

    // Process each deferred item
    const deferredItems = [...this.deferredPolicyModules];
    this.deferredPolicyModules = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred PolicyModule (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            module_id: item.data.module_id,
            created_by: item.data.created_by,
            timestamp: new Date().toISOString(),
          },
        });

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        logger.error({
          message: `Failed to process deferred PolicyModule`,
          metadata: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            module_id: item.data.module_id,
            created_by: item.data.created_by,
            timestamp: new Date().toISOString(),
          },
        });

        // Publish to failed queue
        await mqService.publishToFailed(
          item.data,
          `Failed to process deferred PolicyModule: ${error.message}`
        );
      }
    }
  }

  /**
   * Process deferred PolicySetting objects that were waiting for their referenced PolicyModule
   */
  async processDeferredPolicySettings() {
    if (
      !this.deferredPolicySettings ||
      this.deferredPolicySettings.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredPolicySettings.length} deferred PolicySetting objects`,
      timestamp: new Date().toISOString(),
    });

    // Process each deferred item
    const deferredItems = [...this.deferredPolicySettings];
    this.deferredPolicySettings = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred PolicySetting (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            setting_id: item.data.setting_id,
            module_id: item.data.module_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        logger.error({
          message: `Failed to process deferred PolicySetting`,
          metadata: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            setting_id: item.data.setting_id,
            module_id: item.data.module_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Publish to failed queue
        await mqService.publishToFailed(
          item.data,
          `Failed to process deferred PolicySetting: ${error.message}`
        );
      }
    }
  }

  /**
   * Process deferred ProbationPolicy objects that were waiting for referenced Employees
   */
  async processDeferredProbationPolicies() {
    if (
      !this.deferredProbationPolicies ||
      this.deferredProbationPolicies.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredProbationPolicies.length} deferred ProbationPolicy objects`,
      timestamp: new Date().toISOString(),
    });

    // Process each deferred item
    const deferredItems = [...this.deferredProbationPolicies];
    this.deferredProbationPolicies = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred ProbationPolicy (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            policy_id: item.data.policy_id,
            created_by: item.data.created_by,
            timestamp: new Date().toISOString(),
          },
        });

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        logger.error({
          message: `Failed to process deferred ProbationPolicy`,
          metadata: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            policy_id: item.data.policy_id,
            created_by: item.data.created_by,
            timestamp: new Date().toISOString(),
          },
        });

        // Publish to failed queue
        await mqService.publishToFailed(
          item.data,
          `Failed to process deferred ProbationPolicy: ${error.message}`
        );
      }
    }
  }

  /**
   * Process deferred EmployeePersonalDetail objects that were waiting for their referenced Employee
   */
  async processDeferredEmployeePersonalDetails() {
    if (
      !this.deferredEmployeePersonalDetails ||
      this.deferredEmployeePersonalDetails.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredEmployeePersonalDetails.length} deferred EmployeePersonalDetail objects`,
      timestamp: new Date().toISOString(),
    });

    // Process each deferred item
    const deferredItems = [...this.deferredEmployeePersonalDetails];
    this.deferredEmployeePersonalDetails = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred EmployeePersonalDetail (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            empl_personal_det_id: item.data.empl_personal_det_id,
            employee_id: item.data.employee_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Validate UUID format for primary key and employee_id
        if (!validationService.isValidUUID(item.data.empl_personal_det_id)) {
          logger.error({
            message: `Invalid UUID format for empl_personal_det_id, cannot process record`,
            metadata: {
              empl_personal_det_id: item.data.empl_personal_det_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for empl_personal_det_id: ${item.data.empl_personal_det_id}`
          );
          continue; // Skip to next deferred item
        }

        if (!validationService.isValidUUID(item.data.employee_id)) {
          logger.error({
            message: `Invalid UUID format for employee_id reference in EmployeePersonalDetail`,
            metadata: {
              empl_personal_det_id: item.data.empl_personal_det_id,
              employee_id: item.data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for employee_id: ${item.data.employee_id} in EmployeePersonalDetail`
          );
          continue;
        }

        // Check if referenced Employee exists before attempting to insert
        try {
          const employeeExists = await this.entityExists(
            "Employee",
            item.data.employee_id
          );
          if (!employeeExists) {
            // If Employee still doesn't exist and we haven't reached max retries, defer again
            if (item.attempt < this.maxRetries - 1) {
              logger.warn({
                message: `Referenced Employee still not found for EmployeePersonalDetail, deferring again`,
                metadata: {
                  empl_personal_det_id: item.data.empl_personal_det_id,
                  employee_id: item.data.employee_id,
                  attempt: item.attempt + 1,
                  timestamp: new Date().toISOString(),
                },
              });
              this.deferredEmployeePersonalDetails.push({
                data: item.data,
                schemaName: item.schemaName,
                attempt: item.attempt + 1,
              });
              continue;
            } else {
              // Max retries reached, publish to failed queue
              logger.error({
                message: `Referenced Employee not found for EmployeePersonalDetail after max retries`,
                metadata: {
                  empl_personal_det_id: item.data.empl_personal_det_id,
                  employee_id: item.data.employee_id,
                  timestamp: new Date().toISOString(),
                },
              });
              await mqService.publishToFailed(
                item.data,
                `Referenced Employee not found after ${this.maxRetries} retries`
              );
              continue;
            }
          }
        } catch (error) {
          logger.error({
            message: `Error checking for Employee existence for EmployeePersonalDetail`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              empl_personal_det_id: item.data.empl_personal_det_id,
              employee_id: item.data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
        }

        // Set flag to mark this as a deferred object being retried
        item.data.deferredProcessing = true;

        // Format date fields if present
        if (item.data.marriage_date) {
          try {
            item.data.marriage_date = new Date(item.data.marriage_date);
            if (isNaN(item.data.marriage_date.getTime())) {
              logger.warn({
                message: `Invalid marriage_date format for EmployeePersonalDetail, setting to null`,
                metadata: {
                  empl_personal_det_id: item.data.empl_personal_det_id,
                  marriage_date: item.data.marriage_date,
                  timestamp: new Date().toISOString(),
                },
              });
              item.data.marriage_date = null;
            }
          } catch (error) {
            logger.warn({
              message: `Error parsing marriage_date for EmployeePersonalDetail, setting to null`,
              metadata: {
                error: error.message,
                empl_personal_det_id: item.data.empl_personal_det_id,
                marriage_date: item.data.marriage_date,
                timestamp: new Date().toISOString(),
              },
            });
            item.data.marriage_date = null;
          }
        }

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        if (item.attempt < this.maxRetries - 1) {
          // Still within retry limits, add back to deferred queue
          logger.warn({
            message: `Deferred EmployeePersonalDetail processing failed, will retry later`,
            metadata: {
              empl_personal_det_id: item.data.empl_personal_det_id,
              employee_id: item.data.employee_id,
              error: error.message,
              attempt: item.attempt + 1,
              timestamp: new Date().toISOString(),
            },
          });
          this.deferredEmployeePersonalDetails.push({
            data: item.data,
            schemaName: item.schemaName,
            attempt: item.attempt + 1,
          });
        } else {
          // Max retries reached
          logger.error({
            message: `Failed to process deferred EmployeePersonalDetail after max retries`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              empl_personal_det_id: item.data.empl_personal_det_id,
              employee_id: item.data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });

          // Publish to failed queue
          await mqService.publishToFailed(
            item.data,
            `Failed to process deferred EmployeePersonalDetail: ${error.message}`
          );
        }
      }
    }
  }

  /**
   * Process deferred EmployeeBankDetail objects that were waiting for their referenced Employee
   */
  async processDeferredEmployeeBankDetails() {
    if (
      !this.deferredEmployeeBankDetails ||
      this.deferredEmployeeBankDetails.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredEmployeeBankDetails.length} deferred EmployeeBankDetail objects`,
      timestamp: new Date().toISOString(),
    });

    // Process each deferred item
    const deferredItems = [...this.deferredEmployeeBankDetails];
    this.deferredEmployeeBankDetails = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred EmployeeBankDetail (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            employee_bank_id: item.data.employee_bank_id,
            employee_id: item.data.employee_id,
            bank_id: item.data.bank_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Validate UUID format for primary keys and foreign keys
        if (!validationService.isValidUUID(item.data.employee_bank_id)) {
          logger.error({
            message: `Invalid UUID format for employee_bank_id, cannot process record`,
            metadata: {
              employee_bank_id: item.data.employee_bank_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for employee_bank_id: ${item.data.employee_bank_id}`
          );
          continue; // Skip to next deferred item
        }

        if (!validationService.isValidUUID(item.data.employee_id)) {
          logger.error({
            message: `Invalid UUID format for employee_id reference in EmployeeBankDetail`,
            metadata: {
              employee_bank_id: item.data.employee_bank_id,
              employee_id: item.data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for employee_id: ${item.data.employee_id} in EmployeeBankDetail`
          );
          continue;
        }

        if (
          item.data.bank_id &&
          !validationService.isValidUUID(item.data.bank_id)
        ) {
          logger.error({
            message: `Invalid UUID format for bank_id reference in EmployeeBankDetail`,
            metadata: {
              employee_bank_id: item.data.employee_bank_id,
              bank_id: item.data.bank_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for bank_id: ${item.data.bank_id} in EmployeeBankDetail`
          );
          continue;
        }

        // Check if both referenced Employee and Bank exists before attempting to insert
        let canProcess = true;

        try {
          const employeeExists = await this.entityExists(
            "Employee",
            item.data.employee_id
          );
          if (!employeeExists) {
            // If Employee still doesn't exist and we haven't reached max retries, defer again
            if (item.attempt < this.maxRetries - 1) {
              logger.warn({
                message: `Referenced Employee still not found for EmployeeBankDetail, deferring again`,
                metadata: {
                  employee_bank_id: item.data.employee_bank_id,
                  employee_id: item.data.employee_id,
                  attempt: item.attempt + 1,
                  timestamp: new Date().toISOString(),
                },
              });
              canProcess = false;
            } else {
              // Max retries reached, but force-add to cache anyway
              logger.warn({
                message: `Referenced Employee not found for EmployeeBankDetail after max retries, but adding to cache anyway`,
                metadata: {
                  employee_bank_id: item.data.employee_bank_id,
                  employee_id: item.data.employee_id,
                  timestamp: new Date().toISOString(),
                },
              });

              // Set flag to mark this as a deferred object being forcibly processed
              item.data.deferredProcessing = true;

              try {
                // Try to insert with forced cache addition despite missing dependencies
                await this.insertWithRetry(
                  item.data,
                  item.schemaName,
                  item.attempt,
                  true
                );
              } catch (forceError) {
                // Even if this fails, it will be added to cache based on forceCacheAddition flag
                logger.warn({
                  message: `Force-insertion of EmployeeBankDetail failed, but record should be in cache`,
                  metadata: {
                    error: forceError.message,
                    employee_bank_id: item.data.employee_bank_id,
                    timestamp: new Date().toISOString(),
                  },
                });
              }

              // Still log to failed queue for monitoring purposes
              await mqService.publishToFailed(
                item.data,
                `Referenced Employee not found after ${this.maxRetries} retries (but added to cache)`
              );
              continue;
            }
          }

          // Check if bank_id exists if provided
          if (item.data.bank_id) {
            const bankExists = await this.entityExists(
              "BankMaster",
              item.data.bank_id
            );
            if (!bankExists) {
              // If Bank still doesn't exist and we haven't reached max retries, defer again
              if (item.attempt < this.maxRetries - 1) {
                logger.warn({
                  message: `Referenced Bank still not found for EmployeeBankDetail, deferring again`,
                  metadata: {
                    employee_bank_id: item.data.employee_bank_id,
                    bank_id: item.data.bank_id,
                    attempt: item.attempt + 1,
                    timestamp: new Date().toISOString(),
                  },
                });
                canProcess = false;
              } else {
                // Max retries reached, publish to failed queue
                logger.error({
                  message: `Referenced Bank not found for EmployeeBankDetail after max retries`,
                  metadata: {
                    employee_bank_id: item.data.employee_bank_id,
                    bank_id: item.data.bank_id,
                    timestamp: new Date().toISOString(),
                  },
                });
                await mqService.publishToFailed(
                  item.data,
                  `Referenced Bank not found after ${this.maxRetries} retries`
                );
                continue;
              }
            }
          }

          if (!canProcess) {
            // Foreign keys not found yet, requeue with incremented attempt count
            this.deferredEmployeeBankDetails.push({
              data: item.data,
              schemaName: item.schemaName,
              attempt: item.attempt + 1,
            });
            continue;
          }
        } catch (error) {
          logger.error({
            message: `Error checking for dependencies for EmployeeBankDetail`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              employee_bank_id: item.data.employee_bank_id,
              employee_id: item.data.employee_id,
              bank_id: item.data.bank_id,
              timestamp: new Date().toISOString(),
            },
          });

          // Error during dependency check, requeue if within retry limits
          if (item.attempt < this.maxRetries - 1) {
            this.deferredEmployeeBankDetails.push({
              data: item.data,
              schemaName: item.schemaName,
              attempt: item.attempt + 1,
            });
            continue;
          }
        }

        // Set flag to mark this as a deferred object being retried
        item.data.deferredProcessing = true;

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        if (item.attempt < this.maxRetries - 1) {
          // Still within retry limits, add back to deferred queue
          logger.warn({
            message: `Deferred EmployeeBankDetail processing failed, will retry later`,
            metadata: {
              employee_bank_id: item.data.employee_bank_id,
              employee_id: item.data.employee_id,
              error: error.message,
              attempt: item.attempt + 1,
              timestamp: new Date().toISOString(),
            },
          });
          this.deferredEmployeeBankDetails.push({
            data: item.data,
            schemaName: item.schemaName,
            attempt: item.attempt + 1,
          });
        } else {
          // Max retries reached
          logger.error({
            message: `Failed to process deferred EmployeeBankDetail after max retries`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              employee_bank_id: item.data.employee_bank_id,
              employee_id: item.data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });

          // Publish to failed queue
          await mqService.publishToFailed(
            item.data,
            `Failed to process deferred EmployeeBankDetail: ${error.message}`
          );
        }
      }
    }
  }

  /**
   * Process deferred EmployeeFinancialDetail objects that were waiting for their referenced Employee and EmployeeBankDetail
   */
  async processDeferredEmployeeFinancialDetails() {
    if (
      !this.deferredEmployeeFinancialDetails ||
      this.deferredEmployeeFinancialDetails.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredEmployeeFinancialDetails.length} deferred EmployeeFinancialDetail objects`,
      timestamp: new Date().toISOString(),
    });

    // Process each deferred item
    const deferredItems = [...this.deferredEmployeeFinancialDetails];
    this.deferredEmployeeFinancialDetails = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred EmployeeFinancialDetail (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            empl_financial_id: item.data.empl_financial_id,
            employee_id: item.data.employee_id,
            employee_bank_id: item.data.employee_bank_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Validate UUID format for primary key and foreign keys
        if (!validationService.isValidUUID(item.data.empl_financial_id)) {
          logger.error({
            message: `Invalid UUID format for empl_financial_id, cannot process record`,
            metadata: {
              empl_financial_id: item.data.empl_financial_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for empl_financial_id: ${item.data.empl_financial_id}`
          );
          continue; // Skip to next deferred item
        }

        if (!validationService.isValidUUID(item.data.employee_id)) {
          logger.error({
            message: `Invalid UUID format for employee_id reference in EmployeeFinancialDetail`,
            metadata: {
              empl_financial_id: item.data.empl_financial_id,
              employee_id: item.data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for employee_id: ${item.data.employee_id} in EmployeeFinancialDetail`
          );
          continue;
        }

        // If employee_bank_id is present, validate it
        if (
          item.data.employee_bank_id &&
          !validationService.isValidUUID(item.data.employee_bank_id)
        ) {
          logger.error({
            message: `Invalid UUID format for employee_bank_id reference in EmployeeFinancialDetail`,
            metadata: {
              empl_financial_id: item.data.empl_financial_id,
              employee_bank_id: item.data.employee_bank_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for employee_bank_id: ${item.data.employee_bank_id} in EmployeeFinancialDetail`
          );
          continue;
        }

        // Check if required dependencies exist
        let canProcess = true;

        try {
          // Check if the employee exists
          const employeeExists = await this.entityExists(
            "Employee",
            item.data.employee_id
          );
          if (!employeeExists) {
            // Employee is required, if it doesn't exist defer or fail
            if (item.attempt < this.maxRetries - 1) {
              logger.warn({
                message: `Referenced Employee not found for EmployeeFinancialDetail, deferring again`,
                metadata: {
                  empl_financial_id: item.data.empl_financial_id,
                  employee_id: item.data.employee_id,
                  attempt: item.attempt + 1,
                  timestamp: new Date().toISOString(),
                },
              });
              canProcess = false;
            } else {
              // Max retries reached, but force-add to cache anyway
              logger.warn({
                message: `Referenced Employee not found for EmployeeFinancialDetail after max retries, but adding to cache anyway`,
                metadata: {
                  empl_financial_id: item.data.empl_financial_id,
                  employee_id: item.data.employee_id,
                  timestamp: new Date().toISOString(),
                },
              });

              // Set flag to mark this as a deferred object being forcibly processed
              item.data.deferredProcessing = true;

              try {
                // Try to insert with forced cache addition despite missing dependencies
                await this.insertWithRetry(
                  item.data,
                  item.schemaName,
                  item.attempt,
                  true
                );
              } catch (forceError) {
                // Even if this fails, it will be added to cache based on forceCacheAddition flag
                logger.warn({
                  message: `Force-insertion of EmployeeFinancialDetail failed, but record should be in cache`,
                  metadata: {
                    error: forceError.message,
                    empl_financial_id: item.data.empl_financial_id,
                    timestamp: new Date().toISOString(),
                  },
                });
              }

              // Still log to failed queue for monitoring purposes
              await mqService.publishToFailed(
                item.data,
                `Referenced Employee not found after ${this.maxRetries} retries (but added to cache)`
              );
              continue;
            }
          }

          // If employee_bank_id is specified, check if it exists
          if (item.data.employee_bank_id) {
            const bankDetailExists = await this.entityExists(
              "EmployeeBankDetail",
              item.data.employee_bank_id
            );
            if (!bankDetailExists) {
              // Bank detail is optional in terms of data model but if specified it must exist
              if (item.attempt < this.maxRetries - 1) {
                logger.warn({
                  message: `Referenced EmployeeBankDetail not found for EmployeeFinancialDetail, deferring again`,
                  metadata: {
                    empl_financial_id: item.data.empl_financial_id,
                    employee_bank_id: item.data.employee_bank_id,
                    attempt: item.attempt + 1,
                    timestamp: new Date().toISOString(),
                  },
                });
                canProcess = false;
              } else {
                // Max retries reached, publish to failed queue but proceed with forced insertion
                logger.warn({
                  message: `Referenced EmployeeBankDetail not found for EmployeeFinancialDetail after max retries`,
                  metadata: {
                    empl_financial_id: item.data.empl_financial_id,
                    employee_bank_id: item.data.employee_bank_id,
                    timestamp: new Date().toISOString(),
                  },
                });
                // Since bank details may be optional, we'll set it to null and continue processing with forced cache addition
                logger.warn({
                  message: `Setting employee_bank_id to null and proceeding with EmployeeFinancialDetail insertion with forced caching`,
                  metadata: {
                    empl_financial_id: item.data.empl_financial_id,
                    employee_id: item.data.employee_id,
                    timestamp: new Date().toISOString(),
                  },
                });
                item.data.employee_bank_id = null;
              }
            }
          }

          if (!canProcess) {
            // Foreign keys not found yet, requeue with incremented attempt count
            this.deferredEmployeeFinancialDetails.push({
              data: item.data,
              schemaName: item.schemaName,
              attempt: item.attempt + 1,
            });
            continue;
          }
        } catch (error) {
          logger.error({
            message: `Error checking dependencies for EmployeeFinancialDetail`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              empl_financial_id: item.data.empl_financial_id,
              employee_id: item.data.employee_id,
              employee_bank_id: item.data.employee_bank_id,
              timestamp: new Date().toISOString(),
            },
          });

          // If there's an error during the dependency check, defer if within retry limits
          if (item.attempt < this.maxRetries - 1) {
            this.deferredEmployeeFinancialDetails.push({
              data: item.data,
              schemaName: item.schemaName,
              attempt: item.attempt + 1,
            });
            continue;
          }
        }

        // Set flag to mark this as a deferred object being retried
        item.data.deferredProcessing = true;

        // Format decimal fields if present
        const decimalFields = [
          "tax_deducted",
          "pf_deducted",
          "bonus",
          "salary",
          "additional_allowance",
        ];
        for (const field of decimalFields) {
          if (item.data[field] !== undefined && item.data[field] !== null) {
            try {
              // Ensure decimal format with 2 decimal places
              const numValue = parseFloat(item.data[field]);
              if (!isNaN(numValue)) {
                item.data[field] = numValue.toFixed(2);
              } else {
                logger.warn({
                  message: `Invalid ${field} format for EmployeeFinancialDetail, setting to 0.00`,
                  metadata: {
                    empl_financial_id: item.data.empl_financial_id,
                    [field]: item.data[field],
                    timestamp: new Date().toISOString(),
                  },
                });
                item.data[field] = "0.00";
              }
            } catch (error) {
              logger.warn({
                message: `Error parsing ${field} for EmployeeFinancialDetail, setting to 0.00`,
                metadata: {
                  error: error.message,
                  empl_financial_id: item.data.empl_financial_id,
                  [field]: item.data[field],
                  timestamp: new Date().toISOString(),
                },
              });
              item.data[field] = "0.00";
            }
          }
        }

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        if (item.attempt < this.maxRetries - 1) {
          // Still within retry limits, add back to deferred queue
          logger.warn({
            message: `Deferred EmployeeFinancialDetail processing failed, will retry later`,
            metadata: {
              empl_financial_id: item.data.empl_financial_id,
              employee_id: item.data.employee_id,
              error: error.message,
              attempt: item.attempt + 1,
              timestamp: new Date().toISOString(),
            },
          });
          this.deferredEmployeeFinancialDetails.push({
            data: item.data,
            schemaName: item.schemaName,
            attempt: item.attempt + 1,
          });
        } else {
          // Max retries reached
          logger.error({
            message: `Failed to process deferred EmployeeFinancialDetail after max retries`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              empl_financial_id: item.data.empl_financial_id,
              employee_id: item.data.employee_id,
              employee_bank_id: item.data.employee_bank_id,
              timestamp: new Date().toISOString(),
            },
          });

          // Publish to failed queue
          await mqService.publishToFailed(
            item.data,
            `Failed to process deferred EmployeeFinancialDetail: ${error.message}`
          );
        }
      }
    }
  }

  /**
   * Process deferred EmployeeSalary objects that were waiting for their referenced Employee and SalaryStructure
   */
  async processDeferredEmployeeSalaries() {
    if (
      !this.deferredEmployeeSalaries ||
      this.deferredEmployeeSalaries.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredEmployeeSalaries.length} deferred EmployeeSalary objects`,
      timestamp: new Date().toISOString(),
    });

    // Process each deferred item
    const deferredItems = [...this.deferredEmployeeSalaries];
    this.deferredEmployeeSalaries = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred EmployeeSalary (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            salary_id: item.data.salary_id,
            employee_id: item.data.employee_id,
            structure_id: item.data.structure_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Validate UUID format for primary key and foreign keys
        if (!validationService.isValidUUID(item.data.salary_id)) {
          logger.error({
            message: `Invalid UUID format for salary_id, cannot process record`,
            metadata: {
              salary_id: item.data.salary_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for salary_id: ${item.data.salary_id}`
          );
          continue; // Skip to next deferred item
        }

        if (!validationService.isValidUUID(item.data.employee_id)) {
          logger.error({
            message: `Invalid UUID format for employee_id reference in EmployeeSalary`,
            metadata: {
              salary_id: item.data.salary_id,
              employee_id: item.data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for employee_id: ${item.data.employee_id} in EmployeeSalary`
          );
          continue;
        }

        if (
          item.data.structure_id &&
          !validationService.isValidUUID(item.data.structure_id)
        ) {
          logger.error({
            message: `Invalid UUID format for structure_id reference in EmployeeSalary`,
            metadata: {
              salary_id: item.data.salary_id,
              structure_id: item.data.structure_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for structure_id: ${item.data.structure_id} in EmployeeSalary`
          );
          continue;
        }

        // Check if required dependencies exist
        let canProcess = true;

        try {
          // Check if the employee exists
          const employeeExists = await this.entityExists(
            "Employee",
            item.data.employee_id
          );
          if (!employeeExists) {
            // Employee is required, if it doesn't exist defer or fail
            if (item.attempt < this.maxRetries - 1) {
              logger.warn({
                message: `Referenced Employee not found for EmployeeSalary, deferring again`,
                metadata: {
                  salary_id: item.data.salary_id,
                  employee_id: item.data.employee_id,
                  attempt: item.attempt + 1,
                  timestamp: new Date().toISOString(),
                },
              });
              canProcess = false;
            } else {
              // Max retries reached, but force-add to cache anyway
              logger.warn({
                message: `Referenced Employee not found for EmployeeSalary after max retries, but adding to cache anyway`,
                metadata: {
                  salary_id: item.data.salary_id,
                  employee_id: item.data.employee_id,
                  timestamp: new Date().toISOString(),
                },
              });

              // Set flag to mark this as a deferred object being forcibly processed
              item.data.deferredProcessing = true;

              try {
                // Try to insert with forced cache addition despite missing dependencies
                await this.insertWithRetry(
                  item.data,
                  item.schemaName,
                  item.attempt,
                  true
                );
              } catch (forceError) {
                // Even if this fails, it will be added to cache based on forceCacheAddition flag
                logger.warn({
                  message: `Force-insertion of EmployeeSalary failed, but record should be in cache`,
                  metadata: {
                    error: forceError.message,
                    salary_id: item.data.salary_id,
                    timestamp: new Date().toISOString(),
                  },
                });
              }

              // Still log to failed queue for monitoring purposes
              await mqService.publishToFailed(
                item.data,
                `Referenced Employee not found after ${this.maxRetries} retries (but added to cache)`
              );
              continue;
            }
          }

          // If structure_id is specified, check if it exists
          if (item.data.structure_id) {
            const structureExists = await this.entityExists(
              "SalaryStructure",
              item.data.structure_id
            );
            if (!structureExists) {
              // Structure is required if specified
              if (item.attempt < this.maxRetries - 1) {
                logger.warn({
                  message: `Referenced SalaryStructure not found for EmployeeSalary, deferring again`,
                  metadata: {
                    salary_id: item.data.salary_id,
                    structure_id: item.data.structure_id,
                    attempt: item.attempt + 1,
                    timestamp: new Date().toISOString(),
                  },
                });
                canProcess = false;
              } else {
                // Max retries reached, publish to failed queue
                logger.error({
                  message: `Referenced SalaryStructure not found for EmployeeSalary after max retries`,
                  metadata: {
                    salary_id: item.data.salary_id,
                    structure_id: item.data.structure_id,
                    timestamp: new Date().toISOString(),
                  },
                });
                await mqService.publishToFailed(
                  item.data,
                  `Referenced SalaryStructure not found after ${this.maxRetries} retries`
                );
                continue;
              }
            }
          }

          if (!canProcess) {
            // Foreign keys not found yet, requeue with incremented attempt count
            this.deferredEmployeeSalaries.push({
              data: item.data,
              schemaName: item.schemaName,
              attempt: item.attempt + 1,
            });
            continue;
          }
        } catch (error) {
          logger.error({
            message: `Error checking dependencies for EmployeeSalary`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              salary_id: item.data.salary_id,
              employee_id: item.data.employee_id,
              structure_id: item.data.structure_id,
              timestamp: new Date().toISOString(),
            },
          });

          // If there's an error during the dependency check, defer if within retry limits
          if (item.attempt < this.maxRetries - 1) {
            this.deferredEmployeeSalaries.push({
              data: item.data,
              schemaName: item.schemaName,
              attempt: item.attempt + 1,
            });
            continue;
          }
        }

        // Set flag to mark this as a deferred object being retried
        item.data.deferredProcessing = true;

        // Format date fields if present
        const dateFields = ["effective_date", "end_date"];
        for (const field of dateFields) {
          if (item.data[field]) {
            try {
              item.data[field] = new Date(item.data[field]);
              if (isNaN(item.data[field].getTime())) {
                logger.warn({
                  message: `Invalid ${field} format for EmployeeSalary, setting to null`,
                  metadata: {
                    salary_id: item.data.salary_id,
                    [field]: item.data[field],
                    timestamp: new Date().toISOString(),
                  },
                });
                item.data[field] = null;
              }
            } catch (error) {
              logger.warn({
                message: `Error parsing ${field} for EmployeeSalary, setting to null`,
                metadata: {
                  error: error.message,
                  salary_id: item.data.salary_id,
                  [field]: item.data[field],
                  timestamp: new Date().toISOString(),
                },
              });
              item.data[field] = null;
            }
          }
        }

        // Format decimal fields if present
        const decimalFields = ["salary_amount", "gross_salary", "net_salary"];
        for (const field of decimalFields) {
          if (item.data[field] !== undefined && item.data[field] !== null) {
            try {
              // Ensure decimal format with 2 decimal places
              const numValue = parseFloat(item.data[field]);
              if (!isNaN(numValue)) {
                item.data[field] = numValue.toFixed(2);
              } else {
                logger.warn({
                  message: `Invalid ${field} format for EmployeeSalary, setting to 0.00`,
                  metadata: {
                    salary_id: item.data.salary_id,
                    [field]: item.data[field],
                    timestamp: new Date().toISOString(),
                  },
                });
                item.data[field] = "0.00";
              }
            } catch (error) {
              logger.warn({
                message: `Error parsing ${field} for EmployeeSalary, setting to 0.00`,
                metadata: {
                  error: error.message,
                  salary_id: item.data.salary_id,
                  [field]: item.data[field],
                  timestamp: new Date().toISOString(),
                },
              });
              item.data[field] = "0.00";
            }
          }
        }

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        if (item.attempt < this.maxRetries - 1) {
          // Still within retry limits, add back to deferred queue
          logger.warn({
            message: `Deferred EmployeeSalary processing failed, will retry later`,
            metadata: {
              salary_id: item.data.salary_id,
              employee_id: item.data.employee_id,
              error: error.message,
              attempt: item.attempt + 1,
              timestamp: new Date().toISOString(),
            },
          });
          this.deferredEmployeeSalaries.push({
            data: item.data,
            schemaName: item.schemaName,
            attempt: item.attempt + 1,
          });
        } else {
          // Max retries reached
          logger.error({
            message: `Failed to process deferred EmployeeSalary after max retries`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              salary_id: item.data.salary_id,
              employee_id: item.data.employee_id,
              structure_id: item.data.structure_id,
              timestamp: new Date().toISOString(),
            },
          });

          // Publish to failed queue
          await mqService.publishToFailed(
            item.data,
            `Failed to process deferred EmployeeSalary: ${error.message}`
          );
        }
      }
    }
  }

  /**
   * Process deferred PayrollCycle objects that were waiting for referenced Organizations and Employees
   */
  async processDeferredPayrollCycles() {
    if (
      !this.deferredPayrollCycles ||
      this.deferredPayrollCycles.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredPayrollCycles.length} deferred PayrollCycle objects`,
      timestamp: new Date().toISOString(),
    });

    // Process each deferred item
    const deferredItems = [...this.deferredPayrollCycles];
    this.deferredPayrollCycles = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred PayrollCycle (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            cycle_id: item.data.cycle_id,
            org_id: item.data.org_id,
            created_by: item.data.created_by,
            timestamp: new Date().toISOString(),
          },
        });

        // Validate UUID format for primary key and foreign keys
        if (!validationService.isValidUUID(item.data.cycle_id)) {
          logger.error({
            message: `Invalid UUID format for cycle_id, cannot process record`,
            metadata: {
              cycle_id: item.data.cycle_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for cycle_id: ${item.data.cycle_id}`
          );
          continue; // Skip to next deferred item
        }

        // Validate org_id if present
        if (
          item.data.org_id &&
          !validationService.isValidUUID(item.data.org_id)
        ) {
          logger.error({
            message: `Invalid UUID format for org_id reference in PayrollCycle`,
            metadata: {
              cycle_id: item.data.cycle_id,
              org_id: item.data.org_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for org_id: ${item.data.org_id} in PayrollCycle`
          );
          continue;
        }

        // Validate employee references if present
        if (
          item.data.created_by &&
          !validationService.isValidUUID(item.data.created_by)
        ) {
          logger.error({
            message: `Invalid UUID format for created_by reference in PayrollCycle`,
            metadata: {
              cycle_id: item.data.cycle_id,
              created_by: item.data.created_by,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for created_by: ${item.data.created_by} in PayrollCycle`
          );
          continue;
        }

        // Check if required dependencies exist
        let canProcess = true;

        try {
          // Check if the Organization exists if specified
          if (item.data.org_id) {
            const orgExists = await this.entityExists(
              "Organization",
              item.data.org_id
            );
            if (!orgExists) {
              if (item.attempt < this.maxRetries - 1) {
                logger.warn({
                  message: `Referenced Organization not found for PayrollCycle, deferring again`,
                  metadata: {
                    cycle_id: item.data.cycle_id,
                    org_id: item.data.org_id,
                    attempt: item.attempt + 1,
                    timestamp: new Date().toISOString(),
                  },
                });
                canProcess = false;
              } else {
                // Max retries reached, publish to failed queue
                logger.error({
                  message: `Referenced Organization not found for PayrollCycle after max retries`,
                  metadata: {
                    cycle_id: item.data.cycle_id,
                    org_id: item.data.org_id,
                    timestamp: new Date().toISOString(),
                  },
                });
                await mqService.publishToFailed(
                  item.data,
                  `Referenced Organization not found after ${this.maxRetries} retries`
                );
                continue;
              }
            }
          }

          // Check if the created_by Employee exists if specified
          if (item.data.created_by) {
            const createdByExists = await this.entityExists(
              "Employee",
              item.data.created_by
            );
            if (!createdByExists) {
              if (item.attempt < this.maxRetries - 1) {
                logger.warn({
                  message: `Referenced Employee (created_by) not found for PayrollCycle, deferring again`,
                  metadata: {
                    cycle_id: item.data.cycle_id,
                    created_by: item.data.created_by,
                    attempt: item.attempt + 1,
                    timestamp: new Date().toISOString(),
                  },
                });
                canProcess = false;
              } else {
                // We might still want to process it with a null created_by
                logger.warn({
                  message: `Referenced Employee (created_by) not found, setting to null and proceeding`,
                  metadata: {
                    cycle_id: item.data.cycle_id,
                    created_by: item.data.created_by,
                    timestamp: new Date().toISOString(),
                  },
                });
                item.data.created_by = null;
              }
            }
          }

          if (!canProcess) {
            // Foreign keys not found yet, requeue with incremented attempt count
            this.deferredPayrollCycles.push({
              data: item.data,
              schemaName: item.schemaName,
              attempt: item.attempt + 1,
            });
            continue;
          }
        } catch (error) {
          logger.error({
            message: `Error checking dependencies for PayrollCycle`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              cycle_id: item.data.cycle_id,
              timestamp: new Date().toISOString(),
            },
          });

          // If there's an error during the dependency check, defer if within retry limits
          if (item.attempt < this.maxRetries - 1) {
            this.deferredPayrollCycles.push({
              data: item.data,
              schemaName: item.schemaName,
              attempt: item.attempt + 1,
            });
            continue;
          }
        }

        // Set flag to mark this as a deferred object being retried
        item.data.deferredProcessing = true;

        // Format date fields if present
        const dateFields = [
          "start_date",
          "end_date",
          "payment_date",
          "created_date",
        ];
        for (const field of dateFields) {
          if (item.data[field]) {
            try {
              item.data[field] = new Date(item.data[field]);
              if (isNaN(item.data[field].getTime())) {
                logger.warn({
                  message: `Invalid ${field} format for PayrollCycle, setting to null`,
                  metadata: {
                    cycle_id: item.data.cycle_id,
                    [field]: item.data[field],
                    timestamp: new Date().toISOString(),
                  },
                });
                item.data[field] = null;
              }
            } catch (error) {
              logger.warn({
                message: `Error parsing ${field} for PayrollCycle, setting to null`,
                metadata: {
                  error: error.message,
                  cycle_id: item.data.cycle_id,
                  [field]: item.data[field],
                  timestamp: new Date().toISOString(),
                },
              });
              item.data[field] = null;
            }
          }
        }

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        if (item.attempt < this.maxRetries - 1) {
          // Still within retry limits, add back to deferred queue
          logger.warn({
            message: `Deferred PayrollCycle processing failed, will retry later`,
            metadata: {
              cycle_id: item.data.cycle_id,
              error: error.message,
              attempt: item.attempt + 1,
              timestamp: new Date().toISOString(),
            },
          });
          this.deferredPayrollCycles.push({
            data: item.data,
            schemaName: item.schemaName,
            attempt: item.attempt + 1,
          });
        } else {
          // Max retries reached
          logger.error({
            message: `Failed to process deferred PayrollCycle`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              cycle_id: item.data.cycle_id,
              org_id: item.data.org_id,
              created_by: item.data.created_by,
              timestamp: new Date().toISOString(),
            },
          });

          // Publish to failed queue
          await mqService.publishToFailed(
            item.data,
            `Failed to process deferred PayrollCycle: ${error.message}`
          );
        }
      }
    }
  }

  /**
   * Process deferred PayrollRun objects that were waiting for referenced Employees
   */
  async processDeferredPayrollRuns() {
    if (!this.deferredPayrollRuns || this.deferredPayrollRuns.length === 0) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredPayrollRuns.length} deferred PayrollRun objects`,
      timestamp: new Date().toISOString(),
    });

    // Process each deferred item
    const deferredItems = [...this.deferredPayrollRuns];
    this.deferredPayrollRuns = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred PayrollRun (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            run_id: item.data.run_id,
            processed_by: item.data.processed_by,
            approved_by: item.data.approved_by,
            timestamp: new Date().toISOString(),
          },
        });

        // Validate UUID format for primary key and foreign keys
        if (!validationService.isValidUUID(item.data.run_id)) {
          logger.error({
            message: `Invalid UUID format for run_id, cannot process record`,
            metadata: {
              run_id: item.data.run_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for run_id: ${item.data.run_id}`
          );
          continue; // Skip to next deferred item
        }

        // Validate cycle_id if present
        if (
          item.data.cycle_id &&
          !validationService.isValidUUID(item.data.cycle_id)
        ) {
          logger.error({
            message: `Invalid UUID format for cycle_id reference in PayrollRun`,
            metadata: {
              run_id: item.data.run_id,
              cycle_id: item.data.cycle_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for cycle_id: ${item.data.cycle_id} in PayrollRun`
          );
          continue;
        }

        // Validate employee references if present
        if (
          item.data.processed_by &&
          !validationService.isValidUUID(item.data.processed_by)
        ) {
          logger.error({
            message: `Invalid UUID format for processed_by reference in PayrollRun`,
            metadata: {
              run_id: item.data.run_id,
              processed_by: item.data.processed_by,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for processed_by: ${item.data.processed_by} in PayrollRun`
          );
          continue;
        }

        if (
          item.data.approved_by &&
          !validationService.isValidUUID(item.data.approved_by)
        ) {
          logger.error({
            message: `Invalid UUID format for approved_by reference in PayrollRun`,
            metadata: {
              run_id: item.data.run_id,
              approved_by: item.data.approved_by,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for approved_by: ${item.data.approved_by} in PayrollRun`
          );
          continue;
        }

        // Check if required dependencies exist
        let canProcess = true;

        try {
          // Check if the PayrollCycle exists if specified
          if (item.data.cycle_id) {
            const cycleExists = await this.entityExists(
              "PayrollCycle",
              item.data.cycle_id
            );
            if (!cycleExists) {
              if (item.attempt < this.maxRetries - 1) {
                logger.warn({
                  message: `Referenced PayrollCycle not found for PayrollRun, deferring again`,
                  metadata: {
                    run_id: item.data.run_id,
                    cycle_id: item.data.cycle_id,
                    attempt: item.attempt + 1,
                    timestamp: new Date().toISOString(),
                  },
                });
                canProcess = false;
              } else {
                // Max retries reached, publish to failed queue
                logger.error({
                  message: `Referenced PayrollCycle not found for PayrollRun after max retries`,
                  metadata: {
                    run_id: item.data.run_id,
                    cycle_id: item.data.cycle_id,
                    timestamp: new Date().toISOString(),
                  },
                });
                await mqService.publishToFailed(
                  item.data,
                  `Referenced PayrollCycle not found after ${this.maxRetries} retries`
                );
                continue;
              }
            }
          }

          // Check if the processed_by Employee exists if specified
          if (item.data.processed_by) {
            const processedByExists = await this.entityExists(
              "Employee",
              item.data.processed_by
            );
            if (!processedByExists) {
              if (item.attempt < this.maxRetries - 1) {
                logger.warn({
                  message: `Referenced Employee (processed_by) not found for PayrollRun, deferring again`,
                  metadata: {
                    run_id: item.data.run_id,
                    processed_by: item.data.processed_by,
                    attempt: item.attempt + 1,
                    timestamp: new Date().toISOString(),
                  },
                });
                canProcess = false;
              } else {
                // We might still want to process it with a null processed_by
                logger.warn({
                  message: `Referenced Employee (processed_by) not found, setting to null and proceeding`,
                  metadata: {
                    run_id: item.data.run_id,
                    processed_by: item.data.processed_by,
                    timestamp: new Date().toISOString(),
                  },
                });
                item.data.processed_by = null;
              }
            }
          }

          // Check if the approved_by Employee exists if specified
          if (item.data.approved_by) {
            const approvedByExists = await this.entityExists(
              "Employee",
              item.data.approved_by
            );
            if (!approvedByExists) {
              if (item.attempt < this.maxRetries - 1) {
                logger.warn({
                  message: `Referenced Employee (approved_by) not found for PayrollRun, deferring again`,
                  metadata: {
                    run_id: item.data.run_id,
                    approved_by: item.data.approved_by,
                    attempt: item.attempt + 1,
                    timestamp: new Date().toISOString(),
                  },
                });
                canProcess = false;
              } else {
                // We might still want to process it with a null approved_by
                logger.warn({
                  message: `Referenced Employee (approved_by) not found, setting to null and proceeding`,
                  metadata: {
                    run_id: item.data.run_id,
                    approved_by: item.data.approved_by,
                    timestamp: new Date().toISOString(),
                  },
                });
                item.data.approved_by = null;
              }
            }
          }

          if (!canProcess) {
            // Foreign keys not found yet, requeue with incremented attempt count
            this.deferredPayrollRuns.push({
              data: item.data,
              schemaName: item.schemaName,
              attempt: item.attempt + 1,
            });
            continue;
          }
        } catch (error) {
          logger.error({
            message: `Error checking dependencies for PayrollRun`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              run_id: item.data.run_id,
              timestamp: new Date().toISOString(),
            },
          });

          // If there's an error during the dependency check, defer if within retry limits
          if (item.attempt < this.maxRetries - 1) {
            this.deferredPayrollRuns.push({
              data: item.data,
              schemaName: item.schemaName,
              attempt: item.attempt + 1,
            });
            continue;
          }
        }

        // Set flag to mark this as a deferred object being retried
        item.data.deferredProcessing = true;

        // Format date fields if present
        const dateFields = [
          "run_date",
          "payment_date",
          "start_date",
          "end_date",
        ];
        for (const field of dateFields) {
          if (item.data[field]) {
            try {
              item.data[field] = new Date(item.data[field]);
              if (isNaN(item.data[field].getTime())) {
                logger.warn({
                  message: `Invalid ${field} format for PayrollRun, setting to null`,
                  metadata: {
                    run_id: item.data.run_id,
                    [field]: item.data[field],
                    timestamp: new Date().toISOString(),
                  },
                });
                item.data[field] = null;
              }
            } catch (error) {
              logger.warn({
                message: `Error parsing ${field} for PayrollRun, setting to null`,
                metadata: {
                  error: error.message,
                  run_id: item.data.run_id,
                  [field]: item.data[field],
                  timestamp: new Date().toISOString(),
                },
              });
              item.data[field] = null;
            }
          }
        }

        // Format decimal fields if present
        const decimalFields = [
          "total_amount",
          "gross_amount",
          "net_amount",
          "tax_amount",
        ];
        for (const field of decimalFields) {
          if (item.data[field] !== undefined && item.data[field] !== null) {
            try {
              // Ensure decimal format with 2 decimal places
              const numValue = parseFloat(item.data[field]);
              if (!isNaN(numValue)) {
                item.data[field] = numValue.toFixed(2);
              } else {
                logger.warn({
                  message: `Invalid ${field} format for PayrollRun, setting to 0.00`,
                  metadata: {
                    run_id: item.data.run_id,
                    [field]: item.data[field],
                    timestamp: new Date().toISOString(),
                  },
                });
                item.data[field] = "0.00";
              }
            } catch (error) {
              logger.warn({
                message: `Error parsing ${field} for PayrollRun, setting to 0.00`,
                metadata: {
                  error: error.message,
                  run_id: item.data.run_id,
                  [field]: item.data[field],
                  timestamp: new Date().toISOString(),
                },
              });
              item.data[field] = "0.00";
            }
          }
        }

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        if (item.attempt < this.maxRetries - 1) {
          // Still within retry limits, add back to deferred queue
          logger.warn({
            message: `Deferred PayrollRun processing failed, will retry later`,
            metadata: {
              run_id: item.data.run_id,
              error: error.message,
              attempt: item.attempt + 1,
              timestamp: new Date().toISOString(),
            },
          });
          this.deferredPayrollRuns.push({
            data: item.data,
            schemaName: item.schemaName,
            attempt: item.attempt + 1,
          });
        } else {
          // Max retries reached
          logger.error({
            message: `Failed to process deferred PayrollRun`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              run_id: item.data.run_id,
              processed_by: item.data.processed_by,
              approved_by: item.data.approved_by,
              timestamp: new Date().toISOString(),
            },
          });

          // Publish to failed queue
          await mqService.publishToFailed(
            item.data,
            `Failed to process deferred PayrollRun: ${error.message}`
          );
        }
      }
    }
  }

  /**
   * Process deferred PolicyDocumentVersion objects that were waiting for their referenced PolicyModule
   */
  async processDeferredVersions() {
    if (
      !this.deferredPolicyDocumentVersions ||
      this.deferredPolicyDocumentVersions.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredPolicyDocumentVersions.length} deferred PolicyDocumentVersion objects`,
      timestamp: new Date().toISOString(),
    });

    // Process each deferred item
    const deferredItems = [...this.deferredPolicyDocumentVersions];
    this.deferredPolicyDocumentVersions = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred PolicyDocumentVersion (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            version_id: item.data.version_id,
            module_id: item.data.module_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        logger.error({
          message: `Failed to process deferred PolicyDocumentVersion`,
          metadata: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            version_id: item.data.version_id,
            module_id: item.data.module_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Publish to failed queue
        await mqService.publishToFailed(
          item.data,
          `Failed to process deferred PolicyDocumentVersion: ${error.message}`
        );
      }
    }
  }

  /**
   * Process deferred Employee records that were waiting for their dependencies
   */
  /**
   * Helper method to format date fields in Employee records
   * @param {Object} data - The employee data object
   */
  // formatEmployeeDateFields(data) {
  //   // List of all date fields in the Employee model
  //   const dateFields = [
  //     "date_of_birth",
  //     "date_joined",
  //     "probation_end_date",
  //     "confirmation_date",
  //     "contract_end_date",
  //     "created_at",
  //     "updated_at",
  //     "termination_date", // Additional possible date fields
  //     "exit_date",
  //     "notice_period_start_date",
  //     "notice_period_end_date",
  //   ];

  //   const formatDate = (dateValue) => {
  //     if (!dateValue) return null;

  //     // Handle various date formats that might be coming from different systems
  //     try {
  //       // Try direct ISO parsing first
  //       let dateObj;

  //       // Handle string dates in various formats
  //       if (typeof dateValue === "string") {
  //         // Remove any timezone part if it exists to standardize processing
  //         const normalizedDate = dateValue.replace(/\s*\(.*\)\s*$/, "");

  //         // Handle DD-MM-YYYY or DD/MM/YYYY format
  //         if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(normalizedDate)) {
  //           const parts = normalizedDate.split(/[\/\-]/);
  //           // Assuming DD/MM/YYYY format
  //           dateObj = new Date(parts[2], parts[1] - 1, parts[0]);
  //         }
  //         // Handle YYYY-MM-DD format (SQL standard)
  //         else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalizedDate)) {
  //           dateObj = new Date(normalizedDate);
  //         }
  //         // Handle MM/DD/YYYY format (US format)
  //         else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(normalizedDate)) {
  //           const parts = normalizedDate.split("/");
  //           dateObj = new Date(parts[2], parts[0] - 1, parts[1]);
  //         }
  //         // Default parsing for other formats
  //         else {
  //           dateObj = new Date(normalizedDate);
  //         }
  //       } else if (dateValue instanceof Date) {
  //         // Already a Date object
  //         dateObj = dateValue;
  //       } else {
  //         // Attempt to parse other formats
  //         dateObj = new Date(dateValue);
  //       }

  //       // Validate the result is a legitimate date
  //       if (!isNaN(dateObj.getTime())) {
  //         return dateObj.toISOString();
  //       }
  //       return null;
  //     } catch (error) {
  //       return null;
  //     }
  //   };

  //   for (const field of dateFields) {
  //     if (data[field]) {
  //       const formattedDate = formatDate(data[field]);

  //       if (formattedDate) {
  //         data[field] = formattedDate;
  //       } else {
  //         logger.warn({
  //           message: `Invalid or unparseable date format for ${field} in Employee record, setting to null`,
  //           metadata: {
  //             employee_id: data.employee_id,
  //             employee_number: data.employee_number || "Not provided",
  //             [field]: data[field],
  //             timestamp: new Date().toISOString(),
  //           },
  //         });
  //         data[field] = null;
  //       }
  //     }
  //   }

  //   return data;
  // }

  async processDeferredEmployees() {
    if (!this.deferredEmployees || this.deferredEmployees.length === 0) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredEmployees.length} deferred Employee objects`,
      metadata: {
        count: this.deferredEmployees.length,
        timestamp: new Date().toISOString(),
      },
    });

    // Process each deferred item
    const deferredItems = [...this.deferredEmployees];
    this.deferredEmployees = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred Employee (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            employee_id: item.data.employee_id,
            employee_number: item.data.employee_number,
            org_id: item.data.org_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Validate UUID format for primary key and important foreign keys
        if (!validationService.isValidUUID(item.data.employee_id)) {
          logger.error({
            message: `Invalid UUID format for employee_id, cannot process record`,
            metadata: {
              employee_id: item.data.employee_id,
              timestamp: new Date().toISOString(),
            },
          });
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for employee_id: ${item.data.employee_id}`
          );
          continue; // Skip to next deferred item
        }

        // Validate foreign key UUIDs if present
        const foreignKeyFields = [
          "org_id",
          "work_location_id",
          "dept_id",
          "department_id",
          "job_title_id",
          "employment_type_id",
          "reporting_manager_id",
        ];
        let hasInvalidFK = false;

        for (const field of foreignKeyFields) {
          if (
            item.data[field] &&
            !validationService.isValidUUID(item.data[field])
          ) {
            logger.error({
              message: `Invalid UUID format for ${field}, cannot process employee record`,
              metadata: {
                employee_id: item.data.employee_id,
                [field]: item.data[field],
                timestamp: new Date().toISOString(),
              },
            });
            hasInvalidFK = true;
          }
        }

        // Map department_id to dept_id if needed (to match schema)
        if (item.data.department_id && !item.data.dept_id) {
          item.data.dept_id = item.data.department_id;
          delete item.data.department_id; // Remove non-schema field
          logger.debug({
            message: `Mapped department_id to dept_id for Employee record`,
            metadata: {
              employee_id: item.data.employee_id,
              dept_id: item.data.dept_id,
              timestamp: new Date().toISOString(),
            },
          });
        }

        if (hasInvalidFK) {
          await mqService.publishToFailed(
            item.data,
            `Invalid UUID format for one or more foreign keys in employee record`
          );
          continue; // Skip to next deferred item
        }

        // Set flag to mark this as a deferred object being retried
        item.data.deferredProcessing = true;

        // Format date fields before trying to insert
        // item.data = this.formatEmployeeDateFields(item.data);

        // Check if required foreign keys exist before trying to insert
        const canProcess = await this.validateEmployeeForeignKeys(item.data);

        if (!canProcess) {
          // Foreign keys still missing, requeue with incremented attempt count
          logger.warn({
            message: `Foreign key dependencies still missing for Employee, deferring again`,
            metadata: {
              employee_id: item.data.employee_id,
              employee_number: item.data.employee_number,
              attempt: item.attempt + 1,
              timestamp: new Date().toISOString(),
            },
          });

          if (item.attempt < this.maxRetries - 1) {
            this.deferredEmployees.push({
              data: item.data,
              schemaName: item.schemaName,
              attempt: item.attempt + 1,
            });
          } else {
            // Max retries reached for dependency check
            logger.error({
              message: `Failed to find dependencies for Employee after max retries, but adding to cache anyway`,
              metadata: {
                employee_id: item.data.employee_id,
                employee_number: item.data.employee_number,
                timestamp: new Date().toISOString(),
              },
            });

            // Despite missing dependencies, force-add to cache and try to insert
            // This allows dependent records to be processed even when this employee
            // can't be inserted due to missing dependencies
            logger.info({
              message: `Forcing employee record to cache despite missing dependencies`,
              metadata: {
                employee_id: item.data.employee_id,
                employee_number: item.data.employee_number,
                attempt: item.attempt,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // Last ditch effort - try to insert with forced cache addition
              await this.insertWithRetry(
                item.data,
                item.schemaName,
                item.attempt,
                true
              );
            } catch (forceError) {
              // Even if this fails, it will be added to cache based on the forceCacheAddition flag
              logger.warn({
                message: `Force-insertion failed, but employee should be added to cache`,
                metadata: {
                  error: forceError.message,
                  employee_id: item.data.employee_id,
                  timestamp: new Date().toISOString(),
                },
              });
            }

            // Still publish to failed queue for monitoring
            await mqService.publishToFailed(
              item.data,
              `Failed to find dependencies for Employee after max retries (but added to cache)`
            );
          }
          continue; // Skip to next deferred item
        }

        // Attempt to insert the deferred item
        logger.info({
          message: `Attempting to insert deferred Employee record with forced cache addition`,
          metadata: {
            employee_id: item.data.employee_id,
            employee_number: item.data.employee_number,
            attempt: item.attempt,
            timestamp: new Date().toISOString(),
          },
        });

        // Force cache addition for all employee records, even if insertion fails
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );

        // Check if there are any dependent objects that can now be processed
        await this.processDeferredEmployeePersonalDetails();
        await this.processDeferredEmployeeBankDetails();
        await this.processDeferredEmployeeFinancialDetails();
        await this.processDeferredEmployeeSalaries();
        await this.processDeferredEmployeeShiftAssignments();
      } catch (error) {
        logger.error({
          message: `Error processing deferred Employee`,
          metadata: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            employee_id: item.data.employee_id,
            employee_number: item.data.employee_number,
            timestamp: new Date().toISOString(),
          },
        });

        if (item.attempt < this.maxRetries - 1) {
          // Still within retry limits, add back to deferred queue
          logger.warn({
            message: `Deferred Employee processing failed, will retry later`,
            metadata: {
              employee_id: item.data.employee_id,
              employee_number: item.data.employee_number,
              error: error.message,
              attempt: item.attempt + 1,
              timestamp: new Date().toISOString(),
            },
          });
          this.deferredEmployees.push({
            data: item.data,
            schemaName: item.schemaName,
            attempt: item.attempt + 1,
          });
        } else {
          // Max retries reached
          logger.error({
            message: `Failed to process deferred Employee after max retries`,
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
              employee_id: item.data.employee_id,
              employee_number: item.data.employee_number,
              org_id: item.data.org_id,
              timestamp: new Date().toISOString(),
            },
          });

          // Publish to failed queue
          await mqService.publishToFailed(
            item.data,
            `Failed to process deferred Employee: ${error.message}`
          );
        }
      }
    }
  }

  /**
   * Validate that all required foreign keys for an Employee record exist
   * @param {Object} data - The employee data to validate
   * @returns {Promise<boolean>} - True if all required foreign keys exist, false otherwise
   */
  async validateEmployeeForeignKeys(data) {
    try {
      logger.info({
        message: `Starting employee foreign key validation for employee: ${data.employee_id}`,
        metadata: {
          employee_id: data.employee_id,
          employee_number: data.employee_number,
          org_id: data.org_id,
          timestamp: new Date().toISOString(),
        },
      });

      // Check organization exists - this is usually a required foreign key for employees
      if (!data.org_id) {
        logger.warn({
          message: `Missing required org_id for Employee record`,
          metadata: {
            employee_id: data.employee_id,
            employee_number: data.employee_number,
            timestamp: new Date().toISOString(),
          },
        });
        return false;
      }

      try {
        // Try direct Prisma query first for better reliability
        const orgExists = await prisma.organization.findUnique({
          where: { org_id: data.org_id },
          select: { org_id: true },
        });

        if (!orgExists) {
          // Fallback to general entity check method
          const orgExistsFallback = await this.entityExists(
            "Organization",
            data.org_id
          );

          if (!orgExistsFallback) {
            logger.warn({
              message: `Referenced Organization not found for Employee after both direct query and fallback`,
              metadata: {
                employee_id: data.employee_id,
                employee_number: data.employee_number,
                org_id: data.org_id,
                timestamp: new Date().toISOString(),
              },
            });
            return false;
          } else {
            logger.debug({
              message: `Referenced Organization found through fallback method`,
              metadata: {
                employee_id: data.employee_id,
                org_id: data.org_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        } else {
          logger.debug({
            message: `Referenced Organization found through direct query`,
            metadata: {
              employee_id: data.employee_id,
              org_id: data.org_id,
              timestamp: new Date().toISOString(),
            },
          });
        }
      } catch (error) {
        logger.warn({
          message: `Error checking Organization reference for Employee`,
          metadata: {
            error: error.message,
            stack: error.stack,
            employee_id: data.employee_id,
            employee_number: data.employee_number,
            org_id: data.org_id,
            timestamp: new Date().toISOString(),
          },
        });
        // Don't immediately fail, continue checking other fields
        // This is a change to make the validation more lenient
      }

      // Check work location exists if specified
      let locationValid = true;
      if (data.work_location_id) {
        try {
          const locationExists = await prisma.organizationLocation.findUnique({
            where: { location_id: data.work_location_id },
            select: { location_id: true },
          });

          if (!locationExists) {
            const locationExistsFallback = await this.entityExists(
              "OrganizationLocation",
              data.work_location_id
            );

            if (!locationExistsFallback) {
              logger.warn({
                message: `Referenced OrganizationLocation not found for Employee`,
                metadata: {
                  employee_id: data.employee_id,
                  work_location_id: data.work_location_id,
                  timestamp: new Date().toISOString(),
                },
              });
              locationValid = false;
              // Not returning false immediately - we'll try to create the employee anyway
            }
          }
        } catch (error) {
          logger.warn({
            message: `Error checking OrganizationLocation reference for Employee`,
            metadata: {
              error: error.message,
              stack: error.stack,
              employee_id: data.employee_id,
              work_location_id: data.work_location_id,
              timestamp: new Date().toISOString(),
            },
          });
          locationValid = false;
          // Not returning false immediately - we'll try to create the employee anyway
        }
      }

      // Check department exists if specified
      // Note: The field can be either department_id or dept_id depending on the source system
      const departmentId = data.department_id || data.dept_id;
      let departmentValid = true;
      if (departmentId) {
        try {
          const departmentExists = await prisma.department.findUnique({
            where: { dept_id: departmentId },
            select: { dept_id: true },
          });

          if (!departmentExists) {
            const departmentExistsFallback = await this.entityExists(
              "Department",
              departmentId
            );

            if (!departmentExistsFallback) {
              logger.warn({
                message: `Referenced Department not found for Employee`,
                metadata: {
                  employee_id: data.employee_id,
                  department_id: departmentId,
                  timestamp: new Date().toISOString(),
                },
              });
              departmentValid = false;
              // Not returning false immediately - we'll try to create the employee anyway
            }
          }
        } catch (error) {
          logger.warn({
            message: `Error checking Department reference for Employee`,
            metadata: {
              error: error.message,
              stack: error.stack,
              employee_id: data.employee_id,
              department_id: departmentId,
              timestamp: new Date().toISOString(),
            },
          });
          departmentValid = false;
          // Not returning false immediately - we'll try to create the employee anyway
        }
      }

      // Check job title exists if specified
      let jobTitleValid = true;
      if (data.job_title_id) {
        try {
          const jobTitleExists = await prisma.jobTitle.findUnique({
            where: { job_title_id: data.job_title_id },
            select: { job_title_id: true },
          });

          if (!jobTitleExists) {
            const jobTitleExistsFallback = await this.entityExists(
              "JobTitle",
              data.job_title_id
            );

            if (!jobTitleExistsFallback) {
              logger.warn({
                message: `Referenced JobTitle not found for Employee`,
                metadata: {
                  employee_id: data.employee_id,
                  job_title_id: data.job_title_id,
                  timestamp: new Date().toISOString(),
                },
              });
              jobTitleValid = false;
              // Not returning false immediately - we'll try to create the employee anyway
            }
          }
        } catch (error) {
          logger.warn({
            message: `Error checking JobTitle reference for Employee`,
            metadata: {
              error: error.message,
              stack: error.stack,
              employee_id: data.employee_id,
              job_title_id: data.job_title_id,
              timestamp: new Date().toISOString(),
            },
          });
          jobTitleValid = false;
          // Not returning false immediately - we'll try to create the employee anyway
        }
      }

      // Check employment type exists if specified
      let employmentTypeValid = true;
      if (data.employment_type_id) {
        try {
          const employmentTypeExists = await prisma.employmentType.findUnique({
            where: { employment_type_id: data.employment_type_id },
            select: { employment_type_id: true },
          });

          if (!employmentTypeExists) {
            const employmentTypeExistsFallback = await this.entityExists(
              "EmploymentType",
              data.employment_type_id
            );

            if (!employmentTypeExistsFallback) {
              logger.warn({
                message: `Referenced EmploymentType not found for Employee`,
                metadata: {
                  employee_id: data.employee_id,
                  employment_type_id: data.employment_type_id,
                  timestamp: new Date().toISOString(),
                },
              });
              employmentTypeValid = false;
              // Not returning false immediately - we'll try to create the employee anyway
            }
          }
        } catch (error) {
          logger.warn({
            message: `Error checking EmploymentType reference for Employee`,
            metadata: {
              error: error.message,
              stack: error.stack,
              employee_id: data.employee_id,
              employment_type_id: data.employment_type_id,
              timestamp: new Date().toISOString(),
            },
          });
          employmentTypeValid = false;
          // Not returning false immediately - we'll try to create the employee anyway
        }
      }

      // Log validation summary
      logger.info({
        message: `Employee foreign key validation summary`,
        metadata: {
          employee_id: data.employee_id,
          locationValid,
          departmentValid,
          jobTitleValid,
          employmentTypeValid,
          timestamp: new Date().toISOString(),
        },
      });

      // Return true even if some non-critical foreign keys are invalid
      // This is a more lenient approach that allows employees to be created
      // even if some non-critical references are missing
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
   * Process all deferred objects in the correct order
   */
  async processDeferred() {
    // Process foundation entities first (if any are deferred)
    logger.info({
      message: "Processing deferred entities in prioritized order",
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    // 1. HIGHEST PRIORITY: Process Employee records and their related details in this exact order
    const employeeCount = this.deferredEmployees.length || 0;
    const personalDetailsCount =
      this.deferredEmployeePersonalDetails.length || 0;
    const bankDetailsCount = this.deferredEmployeeBankDetails.length || 0;
    const financialDetailsCount =
      this.deferredEmployeeFinancialDetails.length || 0;

    logger.info({
      message: "Processing employee-related deferred records",
      metadata: {
        employeeCount,
        personalDetailsCount,
        bankDetailsCount,
        financialDetailsCount,
        timestamp: new Date().toISOString(),
      },
    });

    // Process in EXACT specified order: Employee → PersonalDetail → BankDetail → FinancialDetail
    await this.processDeferredEmployees();
    await this.processDeferredEmployeePersonalDetails();
    await this.processDeferredEmployeeBankDetails();
    await this.processDeferredEmployeeFinancialDetails();
    await this.processDeferredEmployeeSalaries();

    // 2. Process other policy and configuration entities
    await this.processDeferredPolicyModules();
    await this.processDeferredProbationPolicies();
    await this.processDeferredPayrollCycles();
    await this.processDeferredPayrollRuns();
    await this.processDeferredLeavePolicyConfigurations();
    await this.processDeferredVersions();
    await this.processDeferredPolicySettings();
    await this.processDeferredAcknowledgments();

    // 3. Process attendance settings that depend on PolicyModule records
    await this.processDeferredAttendanceSettings();

    // 4. Process employee shift assignments that depend on Employee and ShiftConfiguration records
    await this.processDeferredEmployeeShiftAssignments();
  }

  /**
   * Process deferred EmployeeShiftAssignment objects that were waiting for their referenced Employee and ShiftConfiguration
   */
  /**
   * Process deferred AttendanceSettings objects that were waiting for their referenced PolicyModule
   */
  async processDeferredAttendanceSettings() {
    if (
      !this.deferredAttendanceSettings ||
      this.deferredAttendanceSettings.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredAttendanceSettings.length} deferred AttendanceSettings objects`,
      metadata: {
        count: this.deferredAttendanceSettings.length,
        timestamp: new Date().toISOString(),
      },
    });

    // Process each deferred item
    const deferredItems = [...this.deferredAttendanceSettings];
    this.deferredAttendanceSettings = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred AttendanceSettings (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            id: item.data.id,
            moduleId: item.data.moduleId,
            organizationId: item.data.organizationId,
            timestamp: new Date().toISOString(),
          },
        });

        // Set flag to mark this as a deferred object being retried
        item.data.deferredProcessing = true;

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        logger.error({
          message: `Failed to process deferred AttendanceSettings`,
          metadata: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            id: item.data.id,
            moduleId: item.data.moduleId,
            organizationId: item.data.organizationId,
            timestamp: new Date().toISOString(),
          },
        });

        // Publish to failed queue
        await mqService.publishToFailed(
          item.data,
          `Failed to process deferred AttendanceSettings: ${error.message}`
        );
      }
    }
  }

  async processDeferredEmployeeShiftAssignments() {
    if (
      !this.deferredEmployeeShiftAssignments ||
      this.deferredEmployeeShiftAssignments.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredEmployeeShiftAssignments.length} deferred EmployeeShiftAssignment objects`,
      metadata: {
        count: this.deferredEmployeeShiftAssignments.length,
        timestamp: new Date().toISOString(),
      },
    });

    // Process each deferred item
    const deferredItems = [...this.deferredEmployeeShiftAssignments];
    this.deferredEmployeeShiftAssignments = []; // Clear the list to avoid reprocessing

    for (const item of deferredItems) {
      try {
        logger.info({
          message: `Retrying deferred EmployeeShiftAssignment (attempt ${item.attempt}/${this.maxRetries})`,
          metadata: {
            assignment_id: item.data.assignment_id,
            employee_id: item.data.employee_id,
            shift_id: item.data.shift_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Set flag to mark this as a deferred object being retried
        item.data.deferredProcessing = true;

        // Attempt to insert the deferred item with forced cache addition
        // This ensures that even if insertion fails, the record is still cached
        // for dependent records to reference
        await this.insertWithRetry(
          item.data,
          item.schemaName,
          item.attempt,
          true
        );
      } catch (error) {
        logger.error({
          message: `Failed to process deferred EmployeeShiftAssignment`,
          metadata: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            assignment_id: item.data.assignment_id,
            employee_id: item.data.employee_id,
            shift_id: item.data.shift_id,
            timestamp: new Date().toISOString(),
          },
        });

        // Publish to failed queue
        await mqService.publishToFailed(
          item.data,
          `Failed to process deferred EmployeeShiftAssignment: ${error.message}`
        );
      }
    }
  }

  /**
   * Process deferred LeavePolicyConfiguration records
   * These are deferred when a required module_id reference is not found
   */
  async processDeferredLeavePolicyConfigurations() {
    if (
      !this.deferredLeavePolicyConfigurations ||
      this.deferredLeavePolicyConfigurations.length === 0
    ) {
      return;
    }

    logger.info({
      message: `Processing ${this.deferredLeavePolicyConfigurations.length} deferred LeavePolicyConfiguration objects`,
      timestamp: new Date().toISOString(),
    });

    const deferredConfigs = [...this.deferredLeavePolicyConfigurations];
    this.deferredLeavePolicyConfigurations = [];

    for (const { data, schemaName, attempt } of deferredConfigs) {
      try {
        await this.processObject(data, schemaName, attempt + 1);
        logger.info({
          message: `Successfully processed deferred LeavePolicyConfiguration`,
          metadata: {
            config_id: data.config_id,
            leave_type: data.leave_type,
            module_id: data.module_id,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        if (attempt < this.maxRetries - 1) {
          // Still within retry limits, add back to deferred queue
          logger.warn({
            message: `Deferred LeavePolicyConfiguration processing failed, will retry later`,
            metadata: {
              config_id: data.config_id,
              leave_type: data.leave_type,
              error: error.message,
              attempt: attempt + 1,
              timestamp: new Date().toISOString(),
            },
          });
          this.deferredLeavePolicyConfigurations.push({
            data,
            schemaName,
            attempt: attempt + 1,
          });
        } else {
          // Max retries reached, log error and move on
          logger.error({
            message: `Failed to process deferred LeavePolicyConfiguration after max retries`,
            metadata: {
              config_id: data.config_id,
              leave_type: data.leave_type,
              error: error.message,
              maxAttempts: this.maxRetries,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
    }
  }

  /**
   * Identify which schema an object belongs to based on its properties
   * @param {Object} data - The data object
   * @returns {string|null} - The schema name or null if not identified
   */
  identifySchema(data) {
    // Prioritize specific unique identifiers for each schema
    // for (const [key, schema] of Object.entries(this.schemaMap)) {
    //   if (data.hasOwnProperty(key)) {
    //     // Additional checks for specific schemas to avoid misidentification
    //     switch (key) {
    //       case "bank_id":
    //         if (data.hasOwnProperty("bank_type")) {
    //           return schema;
    //         }
    //         break;
    //       case "org_id":
    //         if (data.hasOwnProperty("legal_entity_name")) {
    //           return schema;
    //         }
    //         break;
    //       case "org_bank_id":
    //         if (
    //           data.hasOwnProperty("org_id") &&
    //           data.hasOwnProperty("bank_id")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "org_tax_id":
    //         if (data.hasOwnProperty("org_id") && data.hasOwnProperty("pan")) {
    //           return schema;
    //         }
    //         break;
    //       case "org_compliance_id":
    //         if (
    //           data.hasOwnProperty("org_id") &&
    //           data.hasOwnProperty("compliance_code")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "country_id":
    //         if (data.hasOwnProperty("country_code")) {
    //           return schema;
    //         }
    //         break;
    //       case "state_id":
    //         if (
    //           data.hasOwnProperty("country_id") &&
    //           data.hasOwnProperty("state_code")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "location_id":
    //         if (
    //           data.hasOwnProperty("organizationId") ||
    //           data.hasOwnProperty("org_id")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "dept_type_id":
    //         if (
    //           data.hasOwnProperty("type_name") &&
    //           data.hasOwnProperty("type_code")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "dept_id":
    //         if (
    //           data.hasOwnProperty("dept_code") &&
    //           data.hasOwnProperty("dept_name")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "employment_type_id":
    //         if (
    //           data.hasOwnProperty("type_name") &&
    //           data.hasOwnProperty("type_code")
    //         ) {
    //           // Differentiate from DepartmentType by checking expected values
    //           if (
    //             typeof data.type_name === "string" &&
    //             [
    //               "permanent",
    //               "contract",
    //               "internship",
    //               "part_time",
    //               "probation",
    //             ].includes(data.type_name.toLowerCase())
    //           ) {
    //             return schema;
    //           }
    //         }
    //         break;
    //       case "job_title_id":
    //         if (
    //           data.hasOwnProperty("title_name") &&
    //           data.hasOwnProperty("title_code")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "employee_id":
    //         // More reliable Employee schema detection
    //         if (
    //           // Primary identification pattern - improve to catch more employee objects
    //           (data.hasOwnProperty("employee_number") ||
    //             data.hasOwnProperty("employee_id")) &&
    //           (data.hasOwnProperty("first_name") ||
    //             data.hasOwnProperty("last_name") ||
    //             data.hasOwnProperty("display_name"))
    //         ) {
    //           logger.info({
    //             message: `Identified object as Employee schema`,
    //             metadata: {
    //               employee_id: data.employee_id,
    //               employee_number: data.employee_number,
    //               timestamp: new Date().toISOString(),
    //             },
    //           });
    //           return schema;
    //         }
    //         // Fallback for schema identification using key employee fields
    //         if (
    //           data.employee_id &&
    //           (data.org_id || data.dept_id || data.work_location_id) &&
    //           (data.status === "active" || data.status === "inactive")
    //         ) {
    //           logger.info({
    //             message: `Identified object as Employee schema using fallback pattern`,
    //             metadata: {
    //               employee_id: data.employee_id,
    //               timestamp: new Date().toISOString(),
    //             },
    //           });
    //           return schema;
    //         }
    //         break;
    //       case "empl_personal_det_id":
    //         if (
    //           data.hasOwnProperty("employee_id") &&
    //           (data.hasOwnProperty("marital_status") ||
    //             data.hasOwnProperty("father_name") ||
    //             data.hasOwnProperty("mother_name"))
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "employee_bank_id":
    //         if (
    //           data.hasOwnProperty("employee_id") &&
    //           data.hasOwnProperty("account_number")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "empl_financial_id":
    //         if (
    //           data.hasOwnProperty("employee_id") &&
    //           (data.hasOwnProperty("salary_payment_mode") ||
    //             data.hasOwnProperty("pf_number") ||
    //             data.hasOwnProperty("pan_number"))
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "component_id":
    //         if (
    //           data.hasOwnProperty("component_name") &&
    //           data.hasOwnProperty("component_code") &&
    //           data.hasOwnProperty("component_category")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "structure_id":
    //         if (
    //           data.hasOwnProperty("structure_name") &&
    //           data.hasOwnProperty("structure_code") &&
    //           data.hasOwnProperty("effective_from")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "structure_component_id":
    //         if (
    //           data.hasOwnProperty("structure_id") &&
    //           data.hasOwnProperty("component_id") &&
    //           data.hasOwnProperty("calculation_priority")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "salary_id":
    //         if (
    //           data.hasOwnProperty("employee_id") &&
    //           data.hasOwnProperty("structure_id") &&
    //           data.hasOwnProperty("annual_ctc")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "cycle_id":
    //         if (
    //           data.hasOwnProperty("org_id") &&
    //           data.hasOwnProperty("cycle_name") &&
    //           data.hasOwnProperty("start_day") &&
    //           data.hasOwnProperty("end_day")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "run_id":
    //         if (
    //           data.hasOwnProperty("org_id") &&
    //           data.hasOwnProperty("cycle_id") &&
    //           data.hasOwnProperty("run_date")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "module_id":
    //         if (
    //           data.hasOwnProperty("org_id") &&
    //           data.hasOwnProperty("module_name") &&
    //           data.hasOwnProperty("module_code")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "setting_id":
    //         if (
    //           data.hasOwnProperty("module_id") &&
    //           data.hasOwnProperty("setting_name") &&
    //           data.hasOwnProperty("setting_key") &&
    //           data.hasOwnProperty("setting_value")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "policy_id":
    //         if (
    //           data.hasOwnProperty("org_id") &&
    //           data.hasOwnProperty("probation_code") &&
    //           data.hasOwnProperty("probation_period_months")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "version_id":
    //         if (
    //           data.hasOwnProperty("module_id") &&
    //           data.hasOwnProperty("version_number") &&
    //           data.hasOwnProperty("effective_from")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "acknowledgment_id":
    //         if (
    //           data.hasOwnProperty("version_id") &&
    //           data.hasOwnProperty("employee_id") &&
    //           data.hasOwnProperty("acknowledged_at")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "config_id":
    //         if (
    //           data.hasOwnProperty("module_id") &&
    //           data.hasOwnProperty("org_id") &&
    //           data.hasOwnProperty("leave_type") &&
    //           data.hasOwnProperty("accrual_frequency")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "calendar_id":
    //         if (
    //           data.hasOwnProperty("org_id") &&
    //           data.hasOwnProperty("year") &&
    //           data.hasOwnProperty("start_date") &&
    //           data.hasOwnProperty("end_date")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "holiday_id":
    //         if (
    //           data.hasOwnProperty("org_id") &&
    //           data.hasOwnProperty("holiday_name") &&
    //           data.hasOwnProperty("holiday_type") &&
    //           data.hasOwnProperty("recurrence_type")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "calendar_detail_id":
    //         if (
    //           data.hasOwnProperty("calendar_id") &&
    //           data.hasOwnProperty("holiday_id") &&
    //           data.hasOwnProperty("holiday_date")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "id":
    //         if (
    //           data.hasOwnProperty("organizationId") &&
    //           data.hasOwnProperty("moduleId") &&
    //           data.hasOwnProperty("captureMethods")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "shift_id":
    //         if (
    //           data.hasOwnProperty("org_id") &&
    //           data.hasOwnProperty("shift_name") &&
    //           data.hasOwnProperty("shift_type")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       case "assignment_id":
    //         if (
    //           data.hasOwnProperty("employee_id") &&
    //           data.hasOwnProperty("shift_id") &&
    //           data.hasOwnProperty("effective_from")
    //         ) {
    //           return schema;
    //         }
    //         break;
    //       default:
    //         return schema;
    //     }
    //   }
    // }

    // // Special case for identifying schemas without primary key
    // // These checks are for objects where the primary key might be missing (new objects)
    // if (data.hasOwnProperty("type_name") && data.hasOwnProperty("type_code")) {
    //   if (
    //     data.hasOwnProperty("description") &&
    //     !data.hasOwnProperty("org_id")
    //   ) {
    //     if (
    //       typeof data.type_name === "string" &&
    //       [
    //         "permanent",
    //         "contract",
    //         "internship",
    //         "part_time",
    //         "probation",
    //       ].includes(data.type_name.toLowerCase())
    //     ) {
    //       return "EmploymentType";
    //     } else {
    //       return "DepartmentType";
    //     }
    //   }
    // }

    // if (
    //   data.hasOwnProperty("component_name") &&
    //   data.hasOwnProperty("component_code") &&
    //   data.hasOwnProperty("component_category")
    // ) {
    //   return "SalaryComponentMaster";
    // }

    // // Identify SalaryStructure without primary key
    // if (
    //   data.hasOwnProperty("structure_name") &&
    //   data.hasOwnProperty("structure_code") &&
    //   data.hasOwnProperty("org_id") &&
    //   data.hasOwnProperty("effective_from")
    // ) {
    //   return "SalaryStructure";
    // }

    // // Identify SalaryStructureComponent without primary key
    // if (
    //   data.hasOwnProperty("structure_id") &&
    //   data.hasOwnProperty("component_id") &&
    //   data.hasOwnProperty("calculation_priority")
    // ) {
    //   return "SalaryStructureComponent";
    // }

    // // Identify EmployeeSalary without primary key
    // if (
    //   data.hasOwnProperty("employee_id") &&
    //   data.hasOwnProperty("structure_id") &&
    //   data.hasOwnProperty("annual_ctc") &&
    //   data.hasOwnProperty("monthly_ctc")
    // ) {
    //   return "EmployeeSalary";
    // }

    // // Identify PayrollCycle without primary key
    // if (
    //   data.hasOwnProperty("org_id") &&
    //   data.hasOwnProperty("cycle_name") &&
    //   data.hasOwnProperty("start_day") &&
    //   data.hasOwnProperty("end_day") &&
    //   data.hasOwnProperty("processing_day")
    // ) {
    //   return "PayrollCycle";
    // }

    // // Identify PayrollRun without primary key
    // if (
    //   data.hasOwnProperty("org_id") &&
    //   data.hasOwnProperty("cycle_id") &&
    //   data.hasOwnProperty("run_date") &&
    //   data.hasOwnProperty("start_date") &&
    //   data.hasOwnProperty("end_date")
    // ) {
    //   return "PayrollRun";
    // }

    // // Identify PolicyModule without primary key
    // if (
    //   data.hasOwnProperty("org_id") &&
    //   data.hasOwnProperty("module_name") &&
    //   data.hasOwnProperty("module_code") &&
    //   data.hasOwnProperty("module_category")
    // ) {
    //   return "PolicyModule";
    // }

    // // Identify PolicySetting without primary key
    // if (
    //   data.hasOwnProperty("module_id") &&
    //   data.hasOwnProperty("org_id") &&
    //   data.hasOwnProperty("setting_name") &&
    //   data.hasOwnProperty("setting_key") &&
    //   data.hasOwnProperty("setting_value")
    // ) {
    //   return "PolicySetting";
    // }

    // // Identify ProbationPolicy without primary key
    // if (
    //   data.hasOwnProperty("org_id") &&
    //   data.hasOwnProperty("probation_code") &&
    //   data.hasOwnProperty("probation_period_months") &&
    //   data.hasOwnProperty("extension_allowed")
    // ) {
    //   return "ProbationPolicy";
    // }

    // // Identify PolicyDocumentVersion without primary key
    // if (
    //   data.hasOwnProperty("module_id") &&
    //   data.hasOwnProperty("version_number") &&
    //   data.hasOwnProperty("effective_from") &&
    //   data.hasOwnProperty("document_url")
    // ) {
    //   return "PolicyDocumentVersion";
    // }

    // // Identify PolicyAcknowledgment without primary key
    // if (
    //   data.hasOwnProperty("version_id") &&
    //   data.hasOwnProperty("employee_id") &&
    //   data.hasOwnProperty("acknowledged_at") &&
    //   data.hasOwnProperty("acknowledgment_type")
    // ) {
    //   return "PolicyAcknowledgment";
    // }

    // // Identify LeavePolicyConfiguration without primary key
    // if (
    //   data.hasOwnProperty("module_id") &&
    //   data.hasOwnProperty("org_id") &&
    //   data.hasOwnProperty("leave_type") &&
    //   data.hasOwnProperty("accrual_frequency") &&
    //   data.hasOwnProperty("days_per_year")
    // ) {
    //   return "LeavePolicyConfiguration";
    // }

    // // Identify HolidayCalendarYear without primary key
    // if (
    //   data.hasOwnProperty("org_id") &&
    //   data.hasOwnProperty("year") &&
    //   data.hasOwnProperty("start_date") &&
    //   data.hasOwnProperty("end_date")
    // ) {
    //   return "HolidayCalendarYear";
    // }

    // // Identify HolidayMaster without primary key
    // if (
    //   data.hasOwnProperty("org_id") &&
    //   data.hasOwnProperty("holiday_name") &&
    //   data.hasOwnProperty("holiday_type") &&
    //   data.hasOwnProperty("recurrence_type")
    // ) {
    //   return "HolidayMaster";
    // }

    // // Identify HolidayCalendarDetail without primary key
    // if (
    //   data.hasOwnProperty("calendar_id") &&
    //   data.hasOwnProperty("holiday_id") &&
    //   data.hasOwnProperty("holiday_date")
    // ) {
    //   return "HolidayCalendarDetail";
    // }

    // // Identify AttendanceSettings without primary key
    // if (
    //   data.hasOwnProperty("organizationId") &&
    //   data.hasOwnProperty("moduleId") &&
    //   data.hasOwnProperty("captureMethods") &&
    //   data.hasOwnProperty("shiftType")
    // ) {
    //   return "AttendanceSettings";
    // }

    // // Identify ShiftConfiguration without primary key
    // if (
    //   data.hasOwnProperty("org_id") &&
    //   data.hasOwnProperty("shift_name") &&
    //   data.hasOwnProperty("shift_type") &&
    //   (data.hasOwnProperty("start_time") ||
    //     data.hasOwnProperty("flexible_hours"))
    // ) {
    //   return "ShiftConfiguration";
    // }

    // // Identify EmployeeShiftAssignment without primary key
    // if (
    //   data.hasOwnProperty("employee_id") &&
    //   data.hasOwnProperty("shift_id") &&
    //   data.hasOwnProperty("effective_from")
    // ) {
    //   return "EmployeeShiftAssignment";
    // }

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
   * @param {number} attempt - Current attempt number, defaults to 1
   * @param {boolean} forceCacheAddition - Force adding to the cache even if insertion fails
   */
  async insertWithRetry(
    data,
    schemaName,
    attempt = 1,
    forceCacheAddition = false
  ) {
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

      // Special handling for models with unique constraints
      if (schemaName === "HolidayCalendarYear") {
        // Make sure we include the unique_org_year identifier for upsert
        if (!data.calendar_id && data.org_id && data.year) {
          // If we're creating a new record, make sure we specify how to identify existing records
          // Add a query parameter to indicate that we want to use the unique constraint
          const modifiedUrl = `${url}?useUniqueOrgYear=true`;

          logger.info({
            message: `Using modified URL for HolidayCalendarYear with unique_org_year constraint`,
            metadata: {
              url: modifiedUrl,
              org_id: data.org_id,
              year: data.year,
              timestamp: new Date().toISOString(),
            },
          });

          const response = await axios.post(modifiedUrl, data, {
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

          return;
        }
      }

      // Special handling for AttendanceSettings which has a unique constraint on organizationId
      if (schemaName === "AttendanceSettings") {
        // Make sure we use the organizationId field directly for upsert (which has a unique constraint)
        if (!data.id && data.organizationId) {
          logger.info({
            message: `Using organizationId for AttendanceSettings with unique_org_attendance_settings constraint`,
            metadata: {
              url,
              organizationId: data.organizationId,
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
              organizationId: data.organizationId,
              responseStatus: response.status,
              timestamp: new Date().toISOString(),
            },
          });

          return;
        }
      }

      // Special handling for LeavePolicyConfiguration which has a unique constraint on [org_id, leave_type]
      if (schemaName === "LeavePolicyConfiguration") {
        // Check if the module_id reference exists before trying to insert
        if (data.module_id) {
          try {
            // Check if the referenced PolicyModule exists by trying to fetch it
            const moduleUrl = `${this.baseURL}${this.apiEndpoints["PolicyModule"]}/${data.module_id}`;

            logger.info({
              message: `Checking if referenced PolicyModule exists for LeavePolicyConfiguration`,
              metadata: {
                url: moduleUrl,
                module_id: data.module_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              await axios.get(moduleUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });

              // If we get here, the PolicyModule exists, continue with insertion
              logger.info({
                message: `Referenced PolicyModule found for LeavePolicyConfiguration`,
                metadata: {
                  module_id: data.module_id,
                  timestamp: new Date().toISOString(),
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced PolicyModule doesn't exist yet
                logger.error({
                  message: `Cannot insert LeavePolicyConfiguration - referenced PolicyModule not found`,
                  metadata: {
                    config_id: data.config_id,
                    module_id: data.module_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // The referenced PolicyModule doesn't exist yet
                // Store the LeavePolicyConfiguration data to process after all PolicyModules are processed
                logger.warn({
                  message: `Deferring LeavePolicyConfiguration insertion - referenced PolicyModule not found`,
                  metadata: {
                    config_id: data.config_id,
                    module_id: data.module_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredLeavePolicyConfigurations) {
                  this.deferredLeavePolicyConfigurations = [];
                }
                this.deferredLeavePolicyConfigurations.push({
                  data,
                  schemaName,
                  attempt,
                });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Propagate the error for handling in the retry mechanism
            throw error;
          }
        } else {
          logger.error({
            message: `Cannot insert LeavePolicyConfiguration - module_id is required`,
            metadata: {
              config_id: data.config_id,
              timestamp: new Date().toISOString(),
            },
          });
          throw new Error("module_id is required for LeavePolicyConfiguration");
        }

        // If no config_id is provided but we have org_id and leave_type for uniqueness
        if (!data.config_id && data.org_id && data.leave_type) {
          // Add a query parameter to indicate that we want to use the unique constraint
          const modifiedUrl = `${url}?useUniqueLeaveTypeOrg=true`;

          logger.info({
            message: `Using modified URL for LeavePolicyConfiguration with unique_leave_type_org constraint`,
            metadata: {
              url: modifiedUrl,
              org_id: data.org_id,
              leave_type: data.leave_type,
              timestamp: new Date().toISOString(),
            },
          });

          const response = await axios.post(modifiedUrl, data, {
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

          return;
        }
      }

      // Special handling for Employee to deal with foreign key constraints
      if (schemaName === "Employee") {
        // Force the Employee to be added to cache regardless of insertion success
        // This ensures dependent entities can still refer to it
        forceCacheAddition = true;

        // Check if we have work_location_id reference
        if (data.work_location_id) {
          try {
            // Check if the referenced OrganizationLocation exists by trying to fetch it
            const locationUrl = `${this.baseURL}${this.apiEndpoints["OrganizationLocation"]}/${data.work_location_id}`;

            logger.info({
              message: `Checking if referenced OrganizationLocation exists for Employee`,
              metadata: {
                url: locationUrl,
                work_location_id: data.work_location_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the location doesn't exist in our system yet, we need to defer this employee
              const response = await axios.get(locationUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
                // Set validateStatus to return true for any status code to prevent axios from throwing
                validateStatus: (status) => true,
              });

              // Handle 404 or any error status explicitly rather than through exception
              if (response.status === 404 || response.status >= 400) {
                // The referenced OrganizationLocation doesn't exist yet
                // Store the Employee data to process after all OrganizationLocations are processed
                logger.warn({
                  message: `Deferring Employee insertion - referenced OrganizationLocation not found (Status: ${response.status})`,
                  metadata: {
                    employee_id: data.employee_id,
                    work_location_id: data.work_location_id,
                    status: response.status,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredEmployees) {
                  this.deferredEmployees = [];
                }
                this.deferredEmployees.push({ data, schemaName, attempt });
                return; // Skip insertion for now
              }
            } catch (error) {
              // Handle network errors (not HTTP status errors)
              logger.warn({
                message: `Network error checking OrganizationLocation, deferring Employee insertion`,
                metadata: {
                  employee_id: data.employee_id,
                  work_location_id: data.work_location_id,
                  error: error.message,
                  timestamp: new Date().toISOString(),
                },
              });

              // Store to retry later
              if (!this.deferredEmployees) {
                this.deferredEmployees = [];
              }
              this.deferredEmployees.push({ data, schemaName, attempt });
              return; // Skip insertion for now
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for OrganizationLocation existence for Employee, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                work_location_id: data.work_location_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }

        // Also check for employment_type_id reference if present
        if (data.employment_type_id) {
          try {
            // Check if the referenced EmploymentType exists by trying to fetch it
            const employmentTypeUrl = `${this.baseURL}${this.apiEndpoints["EmploymentType"]}/${data.employment_type_id}`;

            logger.info({
              message: `Checking if referenced EmploymentType exists for Employee`,
              metadata: {
                url: employmentTypeUrl,
                employment_type_id: data.employment_type_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              await axios.get(employmentTypeUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced EmploymentType doesn't exist yet
                logger.warn({
                  message: `Deferring Employee insertion - referenced EmploymentType not found`,
                  metadata: {
                    employee_id: data.employee_id,
                    employment_type_id: data.employment_type_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later if not already deferred for another reason
                if (!this.deferredEmployees) {
                  this.deferredEmployees = [];
                }
                if (
                  !this.deferredEmployees.some(
                    (item) => item.data.employee_id === data.employee_id
                  )
                ) {
                  this.deferredEmployees.push({ data, schemaName, attempt });
                }
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            logger.warn({
              message: `Error checking for EmploymentType existence for Employee, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                employment_type_id: data.employment_type_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }

        // Similarly check for job_title_id if present
        if (data.job_title_id) {
          try {
            // Check if the referenced JobTitle exists by trying to fetch it
            const jobTitleUrl = `${this.baseURL}${this.apiEndpoints["JobTitle"]}/${data.job_title_id}`;

            logger.info({
              message: `Checking if referenced JobTitle exists for Employee`,
              metadata: {
                url: jobTitleUrl,
                job_title_id: data.job_title_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              await axios.get(jobTitleUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced JobTitle doesn't exist yet
                logger.warn({
                  message: `Deferring Employee insertion - referenced JobTitle not found`,
                  metadata: {
                    employee_id: data.employee_id,
                    job_title_id: data.job_title_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later if not already deferred for another reason
                if (!this.deferredEmployees) {
                  this.deferredEmployees = [];
                }
                if (
                  !this.deferredEmployees.some(
                    (item) => item.data.employee_id === data.employee_id
                  )
                ) {
                  this.deferredEmployees.push({ data, schemaName, attempt });
                }
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            logger.warn({
              message: `Error checking for JobTitle existence for Employee, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                job_title_id: data.job_title_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }

        // Also check for dept_id if present
        if (data.dept_id) {
          try {
            // Check if the referenced Department exists by trying to fetch it
            const deptUrl = `${this.baseURL}${this.apiEndpoints["Department"]}/${data.dept_id}`;

            logger.info({
              message: `Checking if referenced Department exists for Employee`,
              metadata: {
                url: deptUrl,
                dept_id: data.dept_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              await axios.get(deptUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced Department doesn't exist yet
                logger.warn({
                  message: `Deferring Employee insertion - referenced Department not found`,
                  metadata: {
                    employee_id: data.employee_id,
                    dept_id: data.dept_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later if not already deferred for another reason
                if (!this.deferredEmployees) {
                  this.deferredEmployees = [];
                }
                if (
                  !this.deferredEmployees.some(
                    (item) => item.data.employee_id === data.employee_id
                  )
                ) {
                  this.deferredEmployees.push({ data, schemaName, attempt });
                }
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            logger.warn({
              message: `Error checking for Department existence for Employee, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                dept_id: data.dept_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Special handling for EmployeePersonalDetail to deal with foreign key constraints
      if (schemaName === "EmployeePersonalDetail") {
        // Check if we have employee_id reference
        if (data.employee_id) {
          try {
            // Check if the referenced Employee exists by trying to fetch it
            const employeeUrl = `${this.baseURL}${this.apiEndpoints["Employee"]}/${data.employee_id}`;

            logger.info({
              message: `Checking if referenced Employee exists for EmployeePersonalDetail`,
              metadata: {
                url: employeeUrl,
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the employee doesn't exist in our system yet, we need to defer this personal detail
              await axios.get(employeeUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced Employee doesn't exist yet
                // Store the EmployeePersonalDetail data to process after all Employees are processed
                logger.warn({
                  message: `Deferring EmployeePersonalDetail insertion - referenced Employee not found`,
                  metadata: {
                    empl_personal_det_id: data.empl_personal_det_id,
                    employee_id: data.employee_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredEmployeePersonalDetails) {
                  this.deferredEmployeePersonalDetails = [];
                }
                this.deferredEmployeePersonalDetails.push({
                  data,
                  schemaName,
                  attempt,
                });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for Employee existence for EmployeePersonalDetail, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Special handling for EmployeeBankDetail to deal with foreign key constraints
      if (schemaName === "EmployeeBankDetail") {
        // Check if we have employee_id reference
        if (data.employee_id) {
          try {
            // Check if the referenced Employee exists by trying to fetch it
            const employeeUrl = `${this.baseURL}${this.apiEndpoints["Employee"]}/${data.employee_id}`;

            logger.info({
              message: `Checking if referenced Employee exists for EmployeeBankDetail`,
              metadata: {
                url: employeeUrl,
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the employee doesn't exist in our system yet, we need to defer this bank detail
              await axios.get(employeeUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced Employee doesn't exist yet
                // Store the EmployeeBankDetail data to process after all Employees are processed
                logger.warn({
                  message: `Deferring EmployeeBankDetail insertion - referenced Employee not found`,
                  metadata: {
                    employee_bank_id: data.employee_bank_id,
                    employee_id: data.employee_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredEmployeeBankDetails) {
                  this.deferredEmployeeBankDetails = [];
                }
                this.deferredEmployeeBankDetails.push({
                  data,
                  schemaName,
                  attempt,
                });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for Employee existence for EmployeeBankDetail, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Special handling for EmployeeFinancialDetail to deal with foreign key constraints
      if (schemaName === "EmployeeFinancialDetail") {
        // Check if we have employee_id reference
        if (data.employee_id) {
          try {
            // Check if the referenced Employee exists by trying to fetch it
            const employeeUrl = `${this.baseURL}${this.apiEndpoints["Employee"]}/${data.employee_id}`;

            logger.info({
              message: `Checking if referenced Employee exists for EmployeeFinancialDetail`,
              metadata: {
                url: employeeUrl,
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the employee doesn't exist in our system yet, we need to defer this financial detail
              await axios.get(employeeUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced Employee doesn't exist yet
                // Store the EmployeeFinancialDetail data to process after all Employees are processed
                logger.warn({
                  message: `Deferring EmployeeFinancialDetail insertion - referenced Employee not found`,
                  metadata: {
                    empl_financial_id: data.empl_financial_id,
                    employee_id: data.employee_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredEmployeeFinancialDetails) {
                  this.deferredEmployeeFinancialDetails = [];
                }
                this.deferredEmployeeFinancialDetails.push({
                  data,
                  schemaName,
                  attempt,
                });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for Employee existence for EmployeeFinancialDetail, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }

        // Check if we have employee_bank_id reference
        if (data.employee_bank_id) {
          try {
            // Check if the referenced EmployeeBankDetail exists by trying to fetch it
            const bankDetailUrl = `${this.baseURL}${this.apiEndpoints["EmployeeBankDetail"]}/${data.employee_bank_id}`;

            logger.info({
              message: `Checking if referenced EmployeeBankDetail exists`,
              metadata: {
                url: bankDetailUrl,
                employee_bank_id: data.employee_bank_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the bank detail doesn't exist in our system yet, we need to defer this financial detail
              await axios.get(bankDetailUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced EmployeeBankDetail doesn't exist yet
                logger.warn({
                  message: `Deferring EmployeeFinancialDetail insertion - referenced EmployeeBankDetail not found`,
                  metadata: {
                    empl_financial_id: data.empl_financial_id,
                    employee_bank_id: data.employee_bank_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredEmployeeFinancialDetails) {
                  this.deferredEmployeeFinancialDetails = [];
                }
                this.deferredEmployeeFinancialDetails.push({
                  data,
                  schemaName,
                  attempt,
                });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            logger.warn({
              message: `Error checking for EmployeeBankDetail existence, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                employee_bank_id: data.employee_bank_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Special handling for EmployeeSalary to deal with foreign key constraints
      if (schemaName === "EmployeeSalary") {
        // Check if we have employee_id reference
        if (data.employee_id) {
          try {
            // Check if the referenced Employee exists by trying to fetch it
            const employeeUrl = `${this.baseURL}${this.apiEndpoints["Employee"]}/${data.employee_id}`;

            logger.info({
              message: `Checking if referenced Employee exists for EmployeeSalary`,
              metadata: {
                url: employeeUrl,
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the employee doesn't exist in our system yet, we need to defer this salary
              await axios.get(employeeUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced Employee doesn't exist yet
                // Store the EmployeeSalary data to process after all Employees are processed
                logger.warn({
                  message: `Deferring EmployeeSalary insertion - referenced Employee not found`,
                  metadata: {
                    salary_id: data.salary_id,
                    employee_id: data.employee_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredEmployeeSalaries) {
                  this.deferredEmployeeSalaries = [];
                }
                this.deferredEmployeeSalaries.push({
                  data,
                  schemaName,
                  attempt,
                });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for Employee existence for EmployeeSalary, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }

        // Check if we have structure_id reference
        if (data.structure_id) {
          try {
            // Check if the referenced SalaryStructure exists by trying to fetch it
            const structureUrl = `${this.baseURL}${this.apiEndpoints["SalaryStructure"]}/${data.structure_id}`;

            logger.info({
              message: `Checking if referenced SalaryStructure exists for EmployeeSalary`,
              metadata: {
                url: structureUrl,
                structure_id: data.structure_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the structure doesn't exist in our system yet, we need to defer this salary
              await axios.get(structureUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced SalaryStructure doesn't exist yet
                // Store the EmployeeSalary data to process after all SalaryStructures are processed
                logger.warn({
                  message: `Deferring EmployeeSalary insertion - referenced SalaryStructure not found`,
                  metadata: {
                    salary_id: data.salary_id,
                    structure_id: data.structure_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredEmployeeSalaries) {
                  this.deferredEmployeeSalaries = [];
                }
                this.deferredEmployeeSalaries.push({
                  data,
                  schemaName,
                  attempt,
                });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for SalaryStructure existence for EmployeeSalary, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                structure_id: data.structure_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Special handling for PayrollRun to deal with foreign key constraints
      if (schemaName === "PayrollRun") {
        // Check if we have processed_by reference
        if (data.processed_by) {
          try {
            // Check if the referenced Employee exists by trying to fetch it
            const employeeUrl = `${this.baseURL}${this.apiEndpoints["Employee"]}/${data.processed_by}`;

            logger.info({
              message: `Checking if referenced Employee exists for PayrollRun (processed_by)`,
              metadata: {
                url: employeeUrl,
                employee_id: data.processed_by,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the employee doesn't exist in our system yet, we need to defer this run
              await axios.get(employeeUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced Employee doesn't exist yet
                // Store the PayrollRun data to process after all Employees are processed
                logger.warn({
                  message: `Deferring PayrollRun insertion - referenced Employee (processed_by) not found`,
                  metadata: {
                    run_id: data.run_id,
                    processed_by: data.processed_by,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredPayrollRuns) {
                  this.deferredPayrollRuns = [];
                }
                this.deferredPayrollRuns.push({ data, schemaName, attempt });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for Employee existence for PayrollRun (processed_by), proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                processed_by: data.processed_by,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }

        // Also check if we have approved_by reference
        if (data.approved_by) {
          try {
            // Check if the referenced Employee exists by trying to fetch it
            const employeeUrl = `${this.baseURL}${this.apiEndpoints["Employee"]}/${data.approved_by}`;

            logger.info({
              message: `Checking if referenced Employee exists for PayrollRun (approved_by)`,
              metadata: {
                url: employeeUrl,
                employee_id: data.approved_by,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the employee doesn't exist in our system yet, we need to defer this run
              await axios.get(employeeUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced Employee doesn't exist yet
                // Store the PayrollRun data to process after all Employees are processed
                logger.warn({
                  message: `Deferring PayrollRun insertion - referenced Employee (approved_by) not found`,
                  metadata: {
                    run_id: data.run_id,
                    approved_by: data.approved_by,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredPayrollRuns) {
                  this.deferredPayrollRuns = [];
                }
                this.deferredPayrollRuns.push({ data, schemaName, attempt });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for Employee existence for PayrollRun (approved_by), proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                approved_by: data.approved_by,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Special handling for PolicyModule to deal with foreign key constraints
      if (schemaName === "PolicyModule") {
        // Check if we have created_by reference
        if (data.created_by) {
          try {
            // Check if the referenced Employee exists by trying to fetch it
            const employeeUrl = `${this.baseURL}${this.apiEndpoints["Employee"]}/${data.created_by}`;

            logger.info({
              message: `Checking if referenced Employee exists for PolicyModule`,
              metadata: {
                url: employeeUrl,
                employee_id: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the employee doesn't exist in our system yet, we need to defer this module
              await axios.get(employeeUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced Employee doesn't exist yet
                // Store the PolicyModule data to process after all Employees are processed
                logger.warn({
                  message: `Deferring PolicyModule insertion - referenced Employee (created_by) not found`,
                  metadata: {
                    module_id: data.module_id,
                    created_by: data.created_by,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredPolicyModules) {
                  this.deferredPolicyModules = [];
                }
                this.deferredPolicyModules.push({ data, schemaName, attempt });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for Employee existence for PolicyModule, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Special handling for ProbationPolicy to deal with foreign key constraints
      if (schemaName === "ProbationPolicy") {
        // Check if we have created_by reference
        if (data.created_by) {
          try {
            // Check if the referenced Employee exists by trying to fetch it
            const employeeUrl = `${this.baseURL}${this.apiEndpoints["Employee"]}/${data.created_by}`;

            logger.info({
              message: `Checking if referenced Employee exists for ProbationPolicy`,
              metadata: {
                url: employeeUrl,
                employee_id: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the employee doesn't exist in our system yet, we need to defer this policy
              await axios.get(employeeUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced Employee doesn't exist yet
                // Store the ProbationPolicy data to process after all Employees are processed
                logger.warn({
                  message: `Deferring ProbationPolicy insertion - referenced Employee (created_by) not found`,
                  metadata: {
                    policy_id: data.policy_id,
                    created_by: data.created_by,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredProbationPolicies) {
                  this.deferredProbationPolicies = [];
                }
                this.deferredProbationPolicies.push({
                  data,
                  schemaName,
                  attempt,
                });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for Employee existence, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                created_by: data.created_by,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Special handling for PolicySetting to deal with foreign key constraints
      if (schemaName === "PolicySetting") {
        // Check if we have module_id reference
        if (data.module_id) {
          try {
            // Check if the referenced PolicyModule exists by trying to fetch it
            const policyModuleUrl = `${this.baseURL}${this.apiEndpoints["PolicyModule"]}/${data.module_id}`;

            logger.info({
              message: `Checking if referenced PolicyModule exists for PolicySetting`,
              metadata: {
                url: policyModuleUrl,
                module_id: data.module_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the policy module doesn't exist in our system yet, we need to defer this setting
              await axios.get(policyModuleUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced PolicyModule doesn't exist yet
                // Store the PolicySetting data to process after all PolicyModules are processed
                logger.warn({
                  message: `Deferring PolicySetting insertion - referenced PolicyModule not found`,
                  metadata: {
                    setting_id: data.setting_id,
                    module_id: data.module_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredPolicySettings) {
                  this.deferredPolicySettings = [];
                }
                this.deferredPolicySettings.push({ data, schemaName, attempt });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for PolicyModule existence for PolicySetting, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                module_id: data.module_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Special handling for AttendanceSettings to deal with foreign key constraints
      if (schemaName === "AttendanceSettings") {
        // Check if we have moduleId reference (different casing from PolicySetting)
        if (data.moduleId) {
          try {
            // Check if the referenced PolicyModule exists by trying to fetch it
            const policyModuleUrl = `${this.baseURL}${this.apiEndpoints["PolicyModule"]}/${data.moduleId}`;

            logger.info({
              message: `Checking if referenced PolicyModule exists for AttendanceSettings`,
              metadata: {
                url: policyModuleUrl,
                moduleId: data.moduleId,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the module doesn't exist in our system yet, we need to defer these settings
              await axios.get(policyModuleUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced PolicyModule doesn't exist yet
                // Store the AttendanceSettings data to process after all PolicyModules are processed
                logger.warn({
                  message: `Deferring AttendanceSettings insertion - referenced PolicyModule not found`,
                  metadata: {
                    id: data.id,
                    moduleId: data.moduleId,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredAttendanceSettings) {
                  this.deferredAttendanceSettings = [];
                }
                this.deferredAttendanceSettings.push({
                  data,
                  schemaName,
                  attempt,
                });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for PolicyModule existence for AttendanceSettings, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                moduleId: data.moduleId,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Special handling for PolicyDocumentVersion to deal with foreign key constraints
      if (schemaName === "PolicyDocumentVersion") {
        // Check if we have module_id reference
        if (data.module_id) {
          try {
            // Check if the referenced PolicyModule exists by trying to fetch it
            const policyModuleUrl = `${this.baseURL}${this.apiEndpoints["PolicyModule"]}/${data.module_id}`;

            logger.info({
              message: `Checking if referenced PolicyModule exists`,
              metadata: {
                url: policyModuleUrl,
                module_id: data.module_id,
                timestamp: new Date().toISOString(),
              },
            });

            // Use the entityExists helper function instead of raw axios.get
            const policyModuleExists = await this.entityExists(
              "PolicyModule",
              data.module_id
            );

            if (!policyModuleExists) {
              // The referenced PolicyModule doesn't exist yet
              // Store the PolicyDocumentVersion data to process after all PolicyModules are processed
              logger.warn({
                message: `Deferring PolicyDocumentVersion insertion - referenced PolicyModule not found`,
                metadata: {
                  version_id: data.version_id,
                  module_id: data.module_id,
                  timestamp: new Date().toISOString(),
                },
              });

              // Store to retry later
              if (!this.deferredPolicyDocumentVersions) {
                this.deferredPolicyDocumentVersions = [];
              }
              this.deferredPolicyDocumentVersions.push({
                data,
                schemaName,
                attempt,
              });
              return; // Skip insertion for now
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for PolicyModule existence, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                module_id: data.module_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Special handling for PolicyAcknowledgment to deal with foreign key constraints
      if (schemaName === "PolicyAcknowledgment") {
        // Check if we have version_id reference
        if (data.version_id) {
          try {
            // Check if the referenced PolicyDocumentVersion exists by trying to fetch it
            const policyVersionUrl = `${this.baseURL}${this.apiEndpoints["PolicyDocumentVersion"]}/${data.version_id}`;

            logger.info({
              message: `Checking if referenced PolicyDocumentVersion exists`,
              metadata: {
                url: policyVersionUrl,
                version_id: data.version_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the document version doesn't exist in our system yet, we need to defer this acknowledgment
              await axios.get(policyVersionUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced PolicyDocumentVersion doesn't exist yet
                // Store the PolicyAcknowledgment data to process after all PolicyDocumentVersions are processed
                logger.warn({
                  message: `Deferring PolicyAcknowledgment insertion - referenced PolicyDocumentVersion not found`,
                  metadata: {
                    acknowledgment_id: data.acknowledgment_id,
                    version_id: data.version_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Store to retry later
                if (!this.deferredPolicyAcknowledgments) {
                  this.deferredPolicyAcknowledgments = [];
                }
                this.deferredPolicyAcknowledgments.push({
                  data,
                  schemaName,
                  attempt,
                });
                return; // Skip insertion for now
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for PolicyDocumentVersion existence, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                version_id: data.version_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      // Special handling for EmployeeShiftAssignment to deal with foreign key constraints
      if (schemaName === "EmployeeShiftAssignment") {
        // Check if we have employee_id reference
        if (data.employee_id) {
          try {
            // Check if the referenced Employee exists by trying to fetch it
            const employeeUrl = `${this.baseURL}${this.apiEndpoints["Employee"]}/${data.employee_id}`;

            logger.info({
              message: `Checking if referenced Employee exists for EmployeeShiftAssignment`,
              metadata: {
                url: employeeUrl,
                employee_id: data.employee_id,
                assignment_id: data.assignment_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the employee doesn't exist in our system yet, we need to defer this assignment
              await axios.get(employeeUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced Employee doesn't exist yet
                // Store the EmployeeShiftAssignment data to process after all Employees are processed
                logger.warn({
                  message: `Deferring EmployeeShiftAssignment insertion - referenced Employee not found`,
                  metadata: {
                    assignment_id: data.assignment_id,
                    employee_id: data.employee_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Skip if this is already being deferred and processed
                if (data.deferredProcessing) {
                  logger.warn({
                    message: `This EmployeeShiftAssignment is already being processed as deferred. Skipping deferral logic.`,
                    metadata: {
                      assignment_id: data.assignment_id,
                      timestamp: new Date().toISOString(),
                    },
                  });
                } else {
                  // Store to retry later
                  if (!this.deferredEmployeeShiftAssignments) {
                    this.deferredEmployeeShiftAssignments = [];
                  }
                  this.deferredEmployeeShiftAssignments.push({
                    data,
                    schemaName,
                    attempt,
                  });
                  return; // Skip insertion for now
                }
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for Employee existence for EmployeeShiftAssignment, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                employee_id: data.employee_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }

        // Check if we have shift_id reference
        if (data.shift_id) {
          try {
            // Check if the referenced ShiftConfiguration exists by trying to fetch it
            const shiftUrl = `${this.baseURL}${this.apiEndpoints["ShiftConfiguration"]}/${data.shift_id}`;

            logger.info({
              message: `Checking if referenced ShiftConfiguration exists for EmployeeShiftAssignment`,
              metadata: {
                url: shiftUrl,
                shift_id: data.shift_id,
                assignment_id: data.assignment_id,
                timestamp: new Date().toISOString(),
              },
            });

            try {
              // If the shift doesn't exist in our system yet, we need to defer this assignment
              await axios.get(shiftUrl, {
                headers: {
                  "Content-Type": "application/json",
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                // The referenced ShiftConfiguration doesn't exist yet
                // Store the EmployeeShiftAssignment data to process after all ShiftConfigurations are processed
                logger.warn({
                  message: `Deferring EmployeeShiftAssignment insertion - referenced ShiftConfiguration not found`,
                  metadata: {
                    assignment_id: data.assignment_id,
                    shift_id: data.shift_id,
                    timestamp: new Date().toISOString(),
                  },
                });

                // Skip if this is already being deferred and processed
                if (data.deferredProcessing) {
                  logger.warn({
                    message: `This EmployeeShiftAssignment is already being processed as deferred. Skipping deferral logic.`,
                    metadata: {
                      assignment_id: data.assignment_id,
                      timestamp: new Date().toISOString(),
                    },
                  });
                } else {
                  // Store to retry later
                  if (!this.deferredEmployeeShiftAssignments) {
                    this.deferredEmployeeShiftAssignments = [];
                  }
                  this.deferredEmployeeShiftAssignments.push({
                    data,
                    schemaName,
                    attempt,
                  });
                  return; // Skip insertion for now
                }
              }
              // For other errors, let the normal retry mechanism handle it
              throw error;
            }
          } catch (error) {
            // Log the error but continue with the insertion attempt
            // The standard retry mechanism will handle failures
            logger.warn({
              message: `Error checking for ShiftConfiguration existence for EmployeeShiftAssignment, proceeding with insertion`,
              metadata: {
                error: {
                  message: error.message,
                  status: error.response?.status,
                },
                shift_id: data.shift_id,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      }

      const response = await axios.post(url, data, {
        headers: {
          "Content-Type": "application/json",
        },
        validateStatus: this.validateStatus,
      });

      // Handle 429 status code for deferred processing
      if (response.status === 429) {
        logger.info({
          message: `Received 429 status code - Deferred processing requested for ${schemaName}`,
          metadata: {
            objectId: this.getPrimaryKeyValue(data, schemaName),
            schemaName,
            timestamp: new Date().toISOString(),
            response: response.data,
          },
        });

        // For EmployeeShiftAssignment, add to deferred list if not already being processed as deferred
        if (
          schemaName === "EmployeeShiftAssignment" &&
          !data.deferredProcessing
        ) {
          logger.info({
            message: `Adding EmployeeShiftAssignment to deferred list for later processing`,
            metadata: {
              assignment_id: data.assignment_id,
              employee_id: data.employee_id,
              shift_id: data.shift_id,
              timestamp: new Date().toISOString(),
            },
          });

          if (!this.deferredEmployeeShiftAssignments) {
            this.deferredEmployeeShiftAssignments = [];
          }
          this.deferredEmployeeShiftAssignments.push({
            data,
            schemaName,
            attempt,
          });
        }

        // Don't throw an error, just return as this is expected behavior
        return;
      }

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
      // Check for specific error types
      const isValidationError = error.response?.status === 400;
      const isPrimaryKeyViolation =
        error.response?.data?.error?.includes("unique constraint") ||
        error.response?.data?.error?.includes("duplicate key") ||
        error.message?.includes("unique constraint") ||
        error.message?.includes("duplicate key");

      // For Employee entities and their dependents, we may want to add them to cache
      // even if there's an insertion failure
      const isEmployeeRelated =
        schemaName === "Employee" ||
        schemaName.startsWith("Employee") ||
        forceCacheAddition;

      // For primary key violations, we can consider it a soft success since the
      // record probably exists already
      if (isPrimaryKeyViolation && isEmployeeRelated) {
        logger.info({
          message: `Primary key violation for ${schemaName} - likely exists already, adding to cache anyway`,
          metadata: {
            objectId: this.getPrimaryKeyValue(data, schemaName),
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        });

        // Add to cache even with the error
        this.addToCache(data, schemaName, data);

        // We don't need to retry in this case
        return;
      }

      // For other validation errors with employee-related records, still cache them
      if (isValidationError && isEmployeeRelated) {
        logger.warn({
          message: `Validation error for ${schemaName}, but adding to cache to allow dependent processing`,
          metadata: {
            objectId: this.getPrimaryKeyValue(data, schemaName),
            error: error.message,
            errorDetails: error.response?.data,
            timestamp: new Date().toISOString(),
          },
        });

        // Add to cache for dependent records
        this.addToCache(data, schemaName, data);
      }

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
        // Use exponential backoff with jitter for more reliable retries
        const baseDelay = 1000; // 1 second
        const maxDelay = 30000; // 30 seconds
        const jitter = 0.5 + Math.random(); // Random between 0.5 and 1.5
        const retryDelay = Math.min(
          maxDelay,
          baseDelay * Math.pow(2, attempt - 1) * jitter
        );

        logger.info({
          message: `Retrying insertion of ${schemaName} (attempt ${attempt + 1}/${this.maxRetries})`,
          metadata: {
            objectId: this.getPrimaryKeyValue(data, schemaName),
            retryDelay,
            timestamp: new Date().toISOString(),
          },
        });

        // Wait before retrying with calculated delay
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return this.insertWithRetry(
          data,
          schemaName,
          attempt + 1,
          forceCacheAddition
        );
      } else {
        // If we've exhausted all retries
        logger.error({
          message: `All insertion attempts failed for ${schemaName} after ${this.maxRetries} attempts`,
          metadata: {
            objectId: this.getPrimaryKeyValue(data, schemaName),
            timestamp: new Date().toISOString(),
          },
        });

        // For employee-related entities, we'll add to cache even after max retries
        // to ensure dependent records can still be processed
        if (
          schemaName === "Employee" ||
          schemaName.startsWith("Employee") ||
          forceCacheAddition
        ) {
          logger.info({
            message: `Adding ${schemaName} to cache despite max retry failures to allow dependent processing`,
            metadata: {
              objectId: this.getPrimaryKeyValue(data, schemaName),
              timestamp: new Date().toISOString(),
            },
          });

          // Force add to cache as last resort
          this.addToCache(data, schemaName, data);

          // Don't perform rollback for employee-related entities
          // This allows continuing with other record processing
          return;
        }

        // For non-employee entities, we'll perform rollback as before
        logger.error({
          message: `Initiating rollback for non-employee entity ${schemaName}`,
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
    const primaryKey = this.getPrimaryKeyValue(data, schemaName);

    // Use a consistent id field name for easier lookup in entityExists
    const cacheEntry = {
      data,
      schemaName,
      id: primaryKey, // Standardized field name for lookup
      primaryKey, // Keep original for backward compatibility
      endpoint: this.apiEndpoints[schemaName],
      responseData,
      timestamp: new Date().toISOString(),
    };

    // Check if this object already exists in cache to avoid duplicates
    const existingIndex = this.processedObjectsCache.findIndex(
      (item) => item.schemaName === schemaName && item.id === primaryKey
    );

    if (existingIndex >= 0) {
      // Update existing entry instead of adding duplicate
      this.processedObjectsCache[existingIndex] = cacheEntry;
      logger.debug({
        message: `Updated existing ${schemaName} in cache`,
        metadata: {
          objectId: primaryKey,
          cacheSize: this.processedObjectsCache.length,
          timestamp: cacheEntry.timestamp,
        },
      });
    } else {
      // Add new entry
      this.processedObjectsCache.push(cacheEntry);

      // For foundation objects, check if there are deferred items that might be unblocked
      if (
        [
          "Organization",
          "OrganizationLocation",
          "Department",
          "JobTitle",
          "EmploymentType",
          "BankMaster",
        ].includes(schemaName)
      ) {
        // Check if we can process any deferred employees now
        if (this.deferredEmployees && this.deferredEmployees.length > 0) {
          logger.info({
            message: `Foundation object ${schemaName} inserted, checking if employee dependencies can be resolved`,
            metadata: {
              foundationObject: schemaName,
              foundationId: primaryKey,
              deferredEmployees: this.deferredEmployees.length,
              timestamp: cacheEntry.timestamp,
            },
          });
        }
      }

      logger.info({
        message: `Added ${schemaName} to cache for potential rollback`,
        metadata: {
          objectId: primaryKey,
          cacheSize: this.processedObjectsCache.length,
          timestamp: cacheEntry.timestamp,
        },
      });
    }
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

  /**
   * Check if an entity exists by its ID using direct database query
   * @param {string} entityType - The type of entity (e.g., 'Employee', 'OrganizationLocation')
   * @param {string} entityId - The ID of the entity to check
   * @returns {Promise<boolean>} - True if the entity exists, false otherwise
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
      // Map entity types to corresponding Prisma model names 
      // IMPORTANT: These must match the actual model names in Prisma exactly (case sensitive)
      const modelMapping = {
        Employee: "employee",
        Organization: "organization",
        OrganizationLocation: "organizationlocation", // Fixed casing to match actual Prisma model name
        Department: "department",
        JobTitle: "jobtitle", // Fixed casing
        EmploymentType: "employmenttype", // Fixed casing
        BankMaster: "bankmaster", // Fixed casing
        PolicyModule: "policymodule", // Fixed casing
        PolicySetting: "policysetting", // Fixed casing
        SalaryStructure: "salarystructure", // Fixed casing
        ShiftConfiguration: "shiftconfiguration", // Fixed casing
        EmployeePersonalDetail: "employeepersonaldetail", // Fixed casing
        EmployeeBankDetail: "employeebankdetail", // Fixed casing
        EmployeeFinancialDetail: "employeefinancialdetail", // Fixed casing
        EmployeeSalary: "employeesalary", // Fixed casing
        PayrollCycle: "payrollcycle", // Fixed casing
        PayrollRun: "payrollrun", // Fixed casing
        AttendanceSettings: "attendancesettings", // Fixed casing
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

      // Check if this entity might be in the cache of already processed objects
      const cachedItem = this.processedObjectsCache.find(
        (item) => item.schemaName === entityType && item.id === entityId
      );

      if (cachedItem) {
        logger.debug({
          message: `Found ${entityType} in cache`,
          metadata: {
            entityType,
            entityId,
            timestamp: new Date().toISOString(),
          },
        });
        return true;
      }

      // First try direct Prisma query - this is the most reliable method
      const modelName = modelMapping[entityType];
      const pkField =
        primaryKeyMapping[entityType] || this.getPrimaryKeyField(entityType);

      if (modelName && pkField) {
        try {
          // Enhanced debugging for entity existence queries
          logger.debug({
            message: `Checking ${entityType} existence with Prisma`,
            metadata: {
              entityType,
              entityId,
              modelName,
              pkField,
              query: `prisma[${modelName}].findUnique({where: { ${pkField}: ${entityId} }})`,
              timestamp: new Date().toISOString(),
            },
          });

          if (!prisma[modelName]) {
            logger.warn({
              message: `Prisma model not found for ${entityType}`,
              metadata: {
                entityType,
                modelName,
                entityId,
                timestamp: new Date().toISOString(),
              },
            });
          } else {
            const queryResult = await prisma[modelName].findUnique({
              where: { [pkField]: entityId },
              select: { [pkField]: true },
            });

            const exists = queryResult !== null;
            if (exists) {
              logger.debug({
                message: `${entityType} existence confirmed with Prisma`,
                metadata: {
                  entityType,
                  entityId,
                  modelName,
                  pkField,
                  timestamp: new Date().toISOString(),
                },
              });
              return true;
            }
          }
        } catch (error) {
          logger.warn({
            message: `Error in Prisma check for ${entityType}`,
            metadata: {
              error: error.message,
              stack: error.stack,
              entityType,
              entityId,
              timestamp: new Date().toISOString(),
            },
          });
          // Fall through to API check
        }
      }

      // Try API check if Prisma failed or didn't find the entity
      const endpoint = this.apiEndpoints[entityType];
      if (endpoint) {
        try {
          const url = `${this.baseURL}${endpoint}/${entityId}`;
          logger.debug({
            message: `Checking if ${entityType} exists via API`,
            metadata: {
              url,
              entityType,
              entityId,
              timestamp: new Date().toISOString(),
            },
          });

          const response = await axios.get(url, {
            validateStatus: this.validateStatus,
            timeout: 5000, // Add timeout to prevent hanging requests
          });

          const exists = response.status === 200;
          logger.debug({
            message: `${entityType} existence check result (API): ${exists}`,
            metadata: {
              entityType,
              entityId,
              status: response.status,
              timestamp: new Date().toISOString(),
            },
          });

          if (exists) {
            return true;
          }
        } catch (error) {
          logger.warn({
            message: `Error checking ${entityType} existence via API`,
            metadata: {
              error: error.message,
              entityType,
              entityId,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // If we got here, we couldn't confirm the entity exists
      logger.warn({
        message: `Could not confirm existence of ${entityType} with ID ${entityId}`,
        metadata: {
          entityType,
          entityId,
          timestamp: new Date().toISOString(),
        },
      });

      // For Employee entities, force add to cache to allow dependent records to be processed
      // This helps with the case where the record may exist but we can't verify it
      if (entityType === "Employee") {
        logger.info({
          message: `Adding Employee to cache despite not being able to confirm existence`,
          metadata: {
            employee_id: entityId,
            timestamp: new Date().toISOString(),
          },
        });
        // Add to processed objects cache to allow dependent objects to be processed
        this.processedObjectsCache.push({
          schemaName: entityType,
          id: entityId,
          deferredProcessingApproved: true,
        });
        return true; // Force success for Employee entities
      }

      return false;
    } catch (error) {
      logger.error({
        message: `Error checking ${entityType} existence`,
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
   * Get the primary key field name for a given entity type
   * @param {string} entityType - The type of entity
   * @returns {string|null} - The primary key field name or null if not found
   */
  getPrimaryKeyField(entityType) {
    // Default primary key field names for common entity types
    const commonMappings = {
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

    if (commonMappings[entityType]) {
      return commonMappings[entityType];
    }

    // Attempt to derive it from schema map by looking for entries where value matches entityType
    for (const [key, value] of Object.entries(this.schemaMap)) {
      if (value === entityType) {
        return key;
      }
    }

    // As a fallback, try to derive it from the entity name
    return entityType.charAt(0).toLowerCase() + entityType.slice(1) + "_id";
  }
}

module.exports = new ConsumePassedData();
