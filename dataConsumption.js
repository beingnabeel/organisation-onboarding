//   THIS IS DEAD CODE JUST FOR THE TESTING PURPOSES//

const axios = require("axios");
const mqService = require("./src/services/mqService");
const validationService = require("./src/services/validationService");
const { logger } = require("./src/utils/logger");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class ConsumePassedData {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 2000;
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
  async startConsumer() {
    try {
      logger.info({
        message: "Starting consumer for passed_data queue",
        timestamp: new Date().toISOString(),
      });
      const channel = await mqService.connect();
      await channel.prefetch(1);
      await channel.consume(
        mqService.passedQueue,
        async (msg) => {
          if (!msg) return;
          try {
            this.processedObjectsCache = [];
            const content = JSON.parse(msg.content.toString());
            logger.info({
              message: "Received message from passed_data queue",
              metadata: {
                messageId: msg.properties.messageId,
                timestamp: new Date().toISOString(),
              },
            });
            await this.processMessage(content);
            channel.ack(msg);
            logger.info({
              message: "Message processed successfully and acknowledged",
              metadata: {
                messageId: msg.properties.messageId,
                timestamp: new Date().toString(),
              },
            });
          } catch (error) {
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
            await mqService.publishToFailed(
              JSON.parse(msg.content.toString()),
              error.message
            );
          }
        },
        { noAck: false }
      );
      logger.info({
        message: "Consumer setup completed for passed_data Queue",
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

  //   now we will start processing the messages and inserting it into the respective tables
  async processMessage(data) {
    // identify which schema the object belongs to :
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
    // if (schemaName === "Employee") {
    //   const canProcess = await this.validateEmployeeForeignKeys(data);
    //   if (!canProcess) {
    //     logger.info({
    //       message: `Employee record requires dependencies, deferring for later processing`,
    //       metadata: {
    //         employee_id: data.employee_id,
    //         employee_number: data.employee_number,
    //         org_id: data.org_id,
    //         timestamp: new Date().toISOString(),
    //       },
    //     });
    //   }
    // }
    await this.insertWithRetry(data, schemaName);
  }
  identifySchema(data) {
    for (const [key, schema] of Object.entries(this.schemaMap)) {
      if (data.hasOwnProperty(key)) {
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
              if (
                typeof data.type_name === "string" &&
                [
                  "permanent",
                  "contract",
                  "intern",
                  "consultant",
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
              data.hasOwnProperty("employee_number") ||
              (data.hasOwnProperty("employee_id") &&
                data.hasOwnProperty("first_name")) ||
              data.hasOwnProperty("last_name") ||
              data.hasOwnProperty("display_name")
            ) {
              logger.infor({
                message: `Identified object as employee schema.`,
                metadata: {
                  employee_id: data.employee_id,
                  employee_number: data.employee_number,
                  timestamp: new Date().toISOString(),
                },
              });
              return schema;
            }
            // Fallback for schema identification using key employee fields
            if (
              data.employee_id &&
              (data.org_id || data.dept_id || data.work_location_id) &&
              (data.status === "active" || data.status === "inactive")
            ) {
              logger.info({
                message: `Identified object as Employee schema using fallback pattern`,
                metadata: {
                  employee_id: data.employee_id,
                  timestamp: new Date().toISOString(),
                },
              });
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
  //   getting the primary key
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
      if (schemaName === "HolidayCalendarYear") {
        if (!data.calendar_id && data.org_id && data.year) {
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
          //   if the operation is successful then we will add it to the cache
          this.addToCache(data, schemaName, response.data);
          logger.info({
            messsage: `Succesfully inserted ${schemaName} into database`,
            metadata: {
              objectId: this.getPrimaryKeyValue(data, schemaName),
              responseStatus: response.status,
              timestamp: new Date().toISOString(),
            },
          });
          return;
        }
      }
      //   handling the case for attendance settings
      if (schemaName === "AttendanceSettings") {
        if (!data.id && data.organizationId) {
          logger.info({
            message: `Using organizationId for attendanceSettings with unique_org_attendance_settins constraint`,
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
      // handling the cases for the leave policy configuration :
      if (schemaName === "LeavePolicyConfiguration") {
        if (data.module_id) {
          try {
            // checking if the referenced policyModule exist by trying to fetch it.
            const moduleUrl = `${this.baseURL}${this.apiEndpoints["PolicyModule"]}${data.module_id}`;
            logger.info({
              message: `Checking if referenced policyModule exists for leavePolicyConfiguration`,
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
              // reaching here means the policyModule exists and we can continue with the insertion.
              logger.info({
                message: `Referenced policyModule found for leave policy configuration`,
                metadata: {
                  module_id: data.module_id,
                  timestamp: new Date().toISOString(),
                },
              });
            } catch (error) {
              if (error.response && error.response.status === 404) {
                logger.error({
                  message: `Cannot insert LeavePolicyConfiguration - referenced policyModule not found`,
                  metadata: {
                    config_id: data.config_id,
                    module_id: data.module_id,
                    timestamp: new Date().toISOString(),
                  },
                });
                return;
              }
              throw error;
            }
          } catch (error) {
            throw error; // propogating the error for handling in the retry mechanism
          }
        } else {
          logger.error({
            message: `Cannot insert leavePolicyConfiguration - module_id is required`,
            metadata: {
              config_id: data.config_id,
              timestamp: new Date().toISOString(),
            },
          });
          throw new Error("module_id is required for leavePolicyConfiguration");
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
      //   handling the employees schema :
      if (schemaName === "Employee") {
        // check if we have work_location_id reference
        if (data.work_location_id) {
          try {
            // check if the referenced OrganizationLocation exist by trying to fetch it .
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
            } catch (error) {}
          } catch (error) {}
        }
      }
    } catch (error) {}
  }
}

module.exports = ConsumePassedData;
