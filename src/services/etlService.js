const xlsx = require("xlsx");
const { logger } = require("../utils/logger");
const AppError = require("../utils/appError");
const {
  generateUUID,
  generateDeterministicUUID,
} = require("../utils/prismaIdGenerator");
const os = require("os");
const { performance } = require("perf_hooks");
const fsPromises = require("fs").promises;
const fs = require("fs");
const mqService = require("./mqService");
const validationService = require("./validationService");

class ETLService {
  constructor() {
    this.ALLOWED_SHEETS = [
      "organisation_details",
      "organisation_locations",
      "organization_departments",
      "Employees_data",
      "Emp_personal_details",
      "Emp_financial_details",
      "salary_component_master",
      "salary_structure",
      "salary_structure_components",
      "Employee_salaries",
      "payroll_cycles",
      "payroll_run",
      "policy_modules",
      "policy_setting",
      "probation_policies",
      "policy_document_versions",
      "policy_acknowledgement",
      "leave_policy_configuration",
      "holiday_master_details",
      "attendance_managment",
      "shift_setting",
      "emp_shift_assignment",
    ];
  }

  /**
   * Format organization details data
   * @param {Array} data - Raw data from Excel
   * @returns {Object} - Formatted organization details
   */
  formatOrganizationDetails(data) {
    const details = data[0]; // Assuming first row contains the details
    return {
      "organisation establishment and financial details": {
        "organisation details": {
          legal_entity_name: details.legal_entity_name,
          auth_signatory_name: details.auth_signatory_name,
          auth_signatory_designation: details.auth_signatory_designation,
          auth_signatory_email: details.auth_signatory_email,
          auth_signatory_father_name: details.auth_signatory_father_name,
          corporation_date: details.corporation_date,
          cin: details.cin,
        },
        "ORGANISATION BANKING DETAILS": {
          bank_type: details.bank_type,
          bank_name: details.bank_name,
          bank_code: details.bank_code,
          swift_code: details.swift_code,
        },
      },
    };
  }

  /**
   * Format organization locations data
   * @param {Array} data - Raw data from Excel
   * @returns {Object} - Formatted locations data
   */
  formatOrganizationLocations(data) {
    return {
      "organisation locations": data.map((location) => ({
        location_name: location.location_name,
        address: location.address,
        city: location.city,
        state: location.state,
        country: location.country,
        pincode: location.pincode,
        contact_person: location.contact_person,
        contact_email: location.contact_email,
        contact_phone: location.contact_phone,
      })),
    };
  }

  /**
   * Format organization departments data
   * @param {Array} data - Raw data from Excel
   * @returns {Object} - Formatted departments data
   */
  formatOrganizationDepartments(data) {
    return {
      "organisation departments": data.map((dept) => ({
        department_name: dept.department_name,
        department_code: dept.department_code,
        department_head: dept.department_head,
        parent_department: dept.parent_department,
        location: dept.location,
      })),
    };
  }

  /**
   * Parse Excel file and write all sheets to etlextract.json
   * @param {string} filePath - Path to the Excel file
   * @returns {Promise<Object>} - Parsed data from all sheets
   */

  // // further more optimised approach
  // async parseExcelFile(filePath) {
  //   try {
  //     // Improve memory usage with streaming options
  //     const options = {
  //       cellDates: true,
  //       dateNF: "MM/DD/YYYY",
  //       // Add stream option to reduce memory footprint for large files
  //       stream: true,
  //       // Add raw data handling to improve performance
  //       raw: true,
  //     };

  //     // Log start of processing
  //     logger.info({
  //       message: "Starting Excel file parsing",
  //       metadata: { filePath },
  //     });

  //     // Performance measurement
  //     const startTime = performance.now();

  //     // Use readFile asynchronously
  //     const workbook = await xlsx.readFile(filePath, options);
  //     const sheets = workbook.SheetNames;

  //     // Determine optimal batch size based on number of sheets and system resources
  //     const cpuCount = os.cpus().length;
  //     const BATCH_SIZE = Math.max(2, Math.min(cpuCount - 1, 8)); // Dynamic batch size based on CPU cores

  //     logger.info({
  //       message: "Parsing Excel file with optimized settings",
  //       metadata: {
  //         totalSheets: sheets.length,
  //         batchSize: BATCH_SIZE,
  //         availableCores: cpuCount,
  //       },
  //     });

  //     // Preallocate the result object to avoid dynamic resizing
  //     const parsedData = Object.create(null); // Faster than {}

  //     // Process sheets in batches
  //     for (let i = 0; i < sheets.length; i += BATCH_SIZE) {
  //       const batchStartTime = performance.now();
  //       const batch = sheets.slice(i, i + BATCH_SIZE);

  //       logger.info({
  //         message: `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sheets.length / BATCH_SIZE)}`,
  //         metadata: {
  //           batchSheets: batch,
  //           progress: `${i}/${sheets.length} sheets`,
  //         },
  //       });

  //       // Process batch of sheets in parallel with better error handling
  //       const batchResults = await Promise.all(
  //         batch.map(async (sheetName) => {
  //           const sheetStartTime = performance.now();
  //           try {
  //             const worksheet = workbook.Sheets[sheetName];

  //             // Check if worksheet exists
  //             if (!worksheet) {
  //               logger.warn({
  //                 message: `Sheet not found: ${sheetName}`,
  //                 metadata: { sheetName },
  //               });
  //               return { sheetName, data: [] };
  //             }

  //             // Get worksheet dimensions for progress reporting
  //             const dimensions = xlsx.utils.decode_range(
  //               worksheet["!ref"] || "A1"
  //             );
  //             const estimatedRows = dimensions.e.r - dimensions.s.r + 1;

  //             // Optimize sheet extraction with improved options
  //             const data = xlsx.utils.sheet_to_json(worksheet, {
  //               raw: true, // Faster parsing
  //               defval: null,
  //               header: 1,
  //               dateNF: "MM/DD/YYYY",
  //               // Add blankrows:false to skip empty rows for performance
  //               blankrows: false,
  //             });

  //             const sheetEndTime = performance.now();
  //             logger.info({
  //               message: `Processed sheet: ${sheetName}`,
  //               metadata: {
  //                 sheetName,
  //                 rowCount: data.length,
  //                 estimatedRows,
  //                 processingTimeMs: Math.round(sheetEndTime - sheetStartTime),
  //               },
  //             });

  //             return { sheetName, data };
  //           } catch (error) {
  //             // Improved error handling with continuation
  //             logger.error({
  //               message: `Error processing sheet: ${sheetName}`,
  //               metadata: {
  //                 sheetName,
  //                 error: {
  //                   message: error.message,
  //                   stack: error.stack,
  //                 },
  //               },
  //             });
  //             // Return empty data instead of throwing to allow other sheets to continue
  //             return { sheetName, data: [], error: error.message };
  //           }
  //         })
  //       );

  //       // Efficiently merge batch results
  //       for (const { sheetName, data, error } of batchResults) {
  //         // Skip sheets with errors
  //         if (!error) {
  //           parsedData[sheetName] = data;
  //         }
  //       }

  //       const batchEndTime = performance.now();
  //       logger.info({
  //         message: `Completed batch ${Math.floor(i / BATCH_SIZE) + 1}`,
  //         metadata: {
  //           processingTimeMs: Math.round(batchEndTime - batchStartTime),
  //           sheetsProcessed: batch.length,
  //         },
  //       });

  //       // Optional: free memory between batches
  //       if (global.gc && i + BATCH_SIZE < sheets.length) {
  //         global.gc();
  //       }
  //     }

  //     // Use streaming writer for large output data
  //     await this.writeFileStream(parsedData, "etlextract.json");

  //     const endTime = performance.now();
  //     logger.info({
  //       message: "Successfully wrote data to etlextract.json",
  //       metadata: {
  //         sheets: Object.keys(parsedData),
  //         totalSheets: Object.keys(parsedData).length,
  //         totalProcessingTimeMs: Math.round(endTime - startTime),
  //       },
  //     });

  //     return parsedData;
  //   } catch (error) {
  //     logger.error({
  //       message: "Error parsing Excel file",
  //       metadata: {
  //         error: {
  //           message: error.message,
  //           stack: error.stack,
  //           code: error.code,
  //         },
  //         filePath,
  //       },
  //     });
  //     throw new AppError(`Failed to parse Excel file: ${error.message}`, 500);
  //   }
  // }

  // // Helper method for streaming write of large JSON files
  // async writeFileStream(data, filename) {
  //   return new Promise((resolve, reject) => {
  //     const writeStream = fs.createWriteStream(filename);
  //     writeStream.write("{\n");

  //     const keys = Object.keys(data);
  //     keys.forEach((key, index) => {
  //       const isLast = index === keys.length - 1;
  //       writeStream.write(
  //         `  ${JSON.stringify(key)}: ${JSON.stringify(data[key])}${isLast ? "" : ","}\n`
  //       );
  //     });

  //     writeStream.write("}\n");
  //     writeStream.end();

  //     writeStream.on("finish", resolve);
  //     writeStream.on("error", reject);
  //   });
  // }

  // CONVERTING ALL THE EXTRACTED CODE TO LOWERCASE :
  async parseExcelFile(filePath) {
    try {
      // Improve memory usage with streaming options
      const options = {
        cellDates: true,
        dateNF: "MM/DD/YYYY",
        // Add stream option to reduce memory footprint for large files
        stream: true,
        // Add raw data handling to improve performance
        raw: true,
      };

      // Log start of processing
      logger.info({
        message: "Starting Excel file parsing",
        metadata: { filePath },
      });

      // Performance measurement
      const startTime = performance.now();

      // Use readFile asynchronously
      const workbook = await xlsx.readFile(filePath, options);
      const sheets = workbook.SheetNames;

      // Determine optimal batch size based on number of sheets and system resources
      const cpuCount = os.cpus().length;
      const BATCH_SIZE = Math.max(2, Math.min(cpuCount - 1, 8)); // Dynamic batch size based on CPU cores

      logger.info({
        message: "Parsing Excel file with optimized settings",
        metadata: {
          totalSheets: sheets.length,
          batchSize: BATCH_SIZE,
          availableCores: cpuCount,
        },
      });

      // Preallocate the result object to avoid dynamic resizing
      const parsedData = Object.create(null); // Faster than {}

      // Process sheets in batches
      for (let i = 0; i < sheets.length; i += BATCH_SIZE) {
        const batchStartTime = performance.now();
        const batch = sheets.slice(i, i + BATCH_SIZE);

        logger.info({
          message: `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sheets.length / BATCH_SIZE)}`,
          metadata: {
            batchSheets: batch,
            progress: `${i}/${sheets.length} sheets`,
          },
        });

        // Process batch of sheets in parallel with better error handling
        const batchResults = await Promise.all(
          batch.map(async (sheetName) => {
            const sheetStartTime = performance.now();
            try {
              const worksheet = workbook.Sheets[sheetName];

              // Check if worksheet exists
              if (!worksheet) {
                logger.warn({
                  message: `Sheet not found: ${sheetName}`,
                  metadata: { sheetName },
                });
                return { sheetName, data: [] };
              }

              // Get worksheet dimensions for progress reporting
              const dimensions = xlsx.utils.decode_range(
                worksheet["!ref"] || "A1"
              );
              const estimatedRows = dimensions.e.r - dimensions.s.r + 1;

              // Optimize sheet extraction with improved options
              const data = xlsx.utils.sheet_to_json(worksheet, {
                raw: true, // Faster parsing
                defval: null,
                header: 1,
                dateNF: "MM/DD/YYYY",
                // Add blankrows:false to skip empty rows for performance
                blankrows: false,
              });

              // Convert all text data to lowercase
              const lowercaseData = data.map((row) =>
                row.map((cell) =>
                  typeof cell === "string" ? cell.toLowerCase() : cell
                )
              );

              const sheetEndTime = performance.now();
              logger.info({
                message: `Processed sheet: ${sheetName}`,
                metadata: {
                  sheetName,
                  rowCount: lowercaseData.length,
                  estimatedRows,
                  processingTimeMs: Math.round(sheetEndTime - sheetStartTime),
                },
              });

              return { sheetName, data: lowercaseData };
            } catch (error) {
              // Improved error handling with continuation
              logger.error({
                message: `Error processing sheet: ${sheetName}`,
                metadata: {
                  sheetName,
                  error: {
                    message: error.message,
                    stack: error.stack,
                  },
                },
              });
              // Return empty data instead of throwing to allow other sheets to continue
              return { sheetName, data: [], error: error.message };
            }
          })
        );

        // Efficiently merge batch results
        for (const { sheetName, data, error } of batchResults) {
          // Skip sheets with errors
          if (!error) {
            parsedData[sheetName] = data;
          }
        }

        const batchEndTime = performance.now();
        logger.info({
          message: `Completed batch ${Math.floor(i / BATCH_SIZE) + 1}`,
          metadata: {
            processingTimeMs: Math.round(batchEndTime - batchStartTime),
            sheetsProcessed: batch.length,
          },
        });

        // Optional: free memory between batches
        if (global.gc && i + BATCH_SIZE < sheets.length) {
          global.gc();
        }
      }

      // Use streaming writer for large output data
      await this.writeFileStream(parsedData, "etlextract.json");

      const endTime = performance.now();
      logger.info({
        message: "Successfully wrote data to etlextract.json",
        metadata: {
          sheets: Object.keys(parsedData),
          totalSheets: Object.keys(parsedData).length,
          totalProcessingTimeMs: Math.round(endTime - startTime),
        },
      });

      return parsedData;
    } catch (error) {
      logger.error({
        message: "Error parsing Excel file",
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
            code: error.code,
          },
          filePath,
        },
      });
      throw new AppError(`Failed to parse Excel file: ${error.message}`, 500);
    }
  }

  // Helper method for streaming write of large JSON files
  async writeFileStream(data, filename) {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filename);
      writeStream.write("{\n");

      const keys = Object.keys(data);
      keys.forEach((key, index) => {
        const isLast = index === keys.length - 1;
        writeStream.write(
          `  ${JSON.stringify(key)}: ${JSON.stringify(data[key])}${isLast ? "" : ","}\n`
        );
      });

      writeStream.write("}\n");
      writeStream.end();

      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
  }
  /**
   * Write data to a file
   * @param {Object} data - The data to write
   * @param {string} filePath - The path to write to
   * @returns {Promise<void>}
   */
  async writeFile(data, filePath) {
    try {
      // Ensure we have a proper JSON string with pretty formatting
      const jsonString = JSON.stringify(data, null, 2);

      // Write to the specified file path
      await fsPromises.writeFile(filePath, jsonString);

      logger.info({
        message: "Successfully wrote data to file",
        metadata: {
          filePath,
          size: Buffer.byteLength(jsonString),
          dataType: Array.isArray(data) ? "Array" : typeof data,
        },
      });
    } catch (error) {
      logger.error({
        message: "Error writing data to file",
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
          },
          filePath,
        },
      });
      throw new AppError("Failed to write data to file", 500);
    }
  }

  /**
   * Transform the data according to business rules
   * @param {Object} data - Processed data from all sheets
   * @returns {Promise<Object>} - Transformed data
   */
  async transformData(data) {
    try {
      // Load data from etlextract.json if not provided
      if (!data) {
        try {
          const extractData = await fsPromises.readFile(
            "etlextract.json",
            "utf8"
          );
          data = JSON.parse(extractData);
        } catch (err) {
          throw new AppError("Failed to read etlextract.json", 500);
        }
      }

      // Initialize transformed data array
      const transformedData = [];
      const currentDateTime = new Date().toISOString();

      // Track created UUIDs to avoid duplicates
      const createdEntities = {
        countries: {},
        states: {},
        organizations: {},
        departmentTypes: {},
        departments: {},
        employmentTypes: {},
        jobTitles: {},
        employees: {},
        managers: {},
        employeePersonalDetails: {},
        banks: {},
        employeeBankDetails: {},
        employeeFinancialDetails: {},
      };

      // Process organization_details sheet if it exists
      if (data.organisation_details && data.organisation_details.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.organisation_details[1];
        // Data is in the third row (index 2)
        const orgData = data.organisation_details[2];

        // Create a map of header to value for easier access
        const orgDataMap = {};
        headers.forEach((header, index) => {
          if (header) {
            orgDataMap[header] = orgData[index];
          }
        });

        // 1. Organization
        const orgId = generateDeterministicUUID(
          orgDataMap.auth_signatory_designation,
          orgDataMap.cin
        );
        createdEntities.organizations[orgId] = true;

        const organizationObj = {
          org_id: orgId,
          legal_entity_name: orgDataMap.legal_entity_name || "",
          auth_signatory_name: orgDataMap.auth_signatory_name || "",
          auth_signatory_designation: orgDataMap.auth_signatory_designation
            ? orgDataMap.auth_signatory_designation.toLowerCase()
            : "",
          auth_signatory_email: orgDataMap.auth_signatory_email || "",
          auth_signatory_father_name:
            orgDataMap.auth_signatory_father_name || "",
          corporation_date: orgDataMap.corporation_date || null,
          cin: orgDataMap.cin || "",
          status: "active",
          created_at: currentDateTime,
          updated_at: currentDateTime,
        };
        transformedData.push(organizationObj);

        const BankCode = orgDataMap.bank_code
          ? orgDataMap.bank_code.toString()
          : "";
        // 2. Bank Master
        const bankId = generateDeterministicUUID(
          orgDataMap.bank_type,
          BankCode
        );
        const bankMasterObj = {
          bank_id: bankId,
          bank_type: orgDataMap.bank_type || "",
          bank_name: orgDataMap.bank_name || "",
          bank_code: BankCode,
          swift_code: orgDataMap.swift_code || "",
          is_active: true,
          created_at: currentDateTime,
          updated_at: currentDateTime,
        };
        transformedData.push(bankMasterObj);
        const AccountNumber = orgDataMap.account_number
          ? orgDataMap.account_number.toString()
          : "";
        // 3. Organization Bank Detail
        const orgBankId = generateDeterministicUUID(
          AccountNumber,
          orgDataMap.ifsc_code
        );
        const orgBankDetailObj = {
          org_bank_id: orgBankId,
          org_id: orgId,
          bank_id: bankId,
          account_number: AccountNumber,
          account_type: orgDataMap.account_type
            ? orgDataMap.account_type.toLowerCase()
            : "",
          ifsc_code: orgDataMap.ifsc_code || "",
          branch_name: orgDataMap.branch_name || "",
          name_on_account: orgDataMap.name_on_account || "",
          is_primary: true,
          status: "active",
          created_at: currentDateTime,
          updated_at: currentDateTime,
        };
        transformedData.push(orgBankDetailObj);

        // 4. Organization Tax Detail
        const orgTaxId = generateDeterministicUUID(
          orgDataMap.pan,
          orgDataMap.tan
        );
        const orgTaxDetailObj = {
          org_tax_id: orgTaxId,
          org_id: orgId,
          pan: orgDataMap.pan || "",
          tan: orgDataMap.tan || "",
          tan_circle_number: orgDataMap.tan_circle_number || "",
          corporated_income_tax_location:
            orgDataMap.corporate_income_tax_locations || "",
          created_at: currentDateTime,
          updated_at: currentDateTime,
        };
        transformedData.push(orgTaxDetailObj);
        const pfEstablishmentId = orgDataMap.pf_establishment_id
          ? orgDataMap.pf_establishment_id.toString()
          : "";
        // 5. Organization Compliance Detail
        const orgComplianceId = generateDeterministicUUID(
          orgDataMap.compliance_code,
          orgDataMap.pf_number
        );
        const orgComplianceDetailObj = {
          org_compliance_id: orgComplianceId,
          org_id: orgId,
          compliance_code: orgDataMap.compliance_code || "",
          pf_establishment_id: pfEstablishmentId,
          pf_number: orgDataMap.pf_number || "",
          pf_registration_date: orgDataMap.pf_registration_date || null,
          esi_number: orgDataMap.esi_number || "",
          esi_registration_date: orgDataMap.esi_registration_date || null,
          pt_establishment_id: orgDataMap.pt_establishment_id || "",
          pt_number: orgDataMap.pt_number || "",
          pt_registration_date: orgDataMap.pt_registration_date || null,
          lwf_establishment_id: orgDataMap.lwf_establishment_id || "",
          lwf_registration_date: orgDataMap.lwf_registration_date || null,
          status: "active",
          created_at: currentDateTime,
          updated_at: currentDateTime,
        };
        transformedData.push(orgComplianceDetailObj);
      }

      // Process organization_locations sheet if it exists
      if (
        data.organisation_locations &&
        data.organisation_locations.length >= 3
      ) {
        // Headers are in the second row (index 1)
        const headers = data.organisation_locations[1];

        // Process rows starting from the third row (index 2)
        for (
          let rowIndex = 2;
          rowIndex < data.organisation_locations.length;
          rowIndex++
        ) {
          const locationData = data.organisation_locations[rowIndex];

          // Create a map of header to value for easier access
          const locationDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              locationDataMap[header] = locationData[index];
            }
          });
          const dialCode = locationDataMap.dial_code
            ? locationDataMap.dial_code.toString()
            : "";
          // 1. Country Master
          const countryId = generateDeterministicUUID(
            locationDataMap.country_code,
            locationDataMap.currency_code
          );

          // Only add country if it hasn't been added yet
          if (!createdEntities.countries[countryId]) {
            createdEntities.countries[countryId] = true;

            const countryMasterObj = {
              country_id: countryId,
              country_code: locationDataMap.country_code || "",
              country_name: locationDataMap.country_name || "",
              dial_code: dialCode,
              currency_code: locationDataMap.currency_code || "",
              is_active: true,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };
            transformedData.push(countryMasterObj);
          }

          // 2. State Master
          const stateId = generateDeterministicUUID(
            locationDataMap.state_code,
            locationDataMap.state_name
          );

          // Only add state if it hasn't been added yet
          if (!createdEntities.states[stateId]) {
            createdEntities.states[stateId] = true;

            const stateMasterObj = {
              state_id: stateId,
              country_id: countryId,
              state_code: locationDataMap.state_code || "",
              state_name: locationDataMap.state_name || "",
              is_active: true,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };
            transformedData.push(stateMasterObj);
          }

          // const BankCode = orgDataMap.bank_code
          // ? orgDataMap.bank_code.toString()
          // : "";
          const pinCodeDetail = locationDataMap.pincode
            ? locationDataMap.pincode.toString()
            : "";
          // 3. Organization Location
          const locationId = generateDeterministicUUID(
            locationDataMap.location_code,
            locationDataMap.city
          );

          // Get the organization ID using auth_signatory_designation and cin
          const orgId = generateDeterministicUUID(
            locationDataMap.auth_signatory_designation,
            locationDataMap.cin
          );

          const organizationLocationObj = {
            location_id: locationId,
            organizationId: orgId,
            location_name: locationDataMap.location_name || "",
            location_code: locationDataMap.location_code || "",
            is_head_office:
              locationDataMap.is_head_office?.toLowerCase() === "yes",
            is_registered_office:
              locationDataMap.is_registered_office?.toLowerCase() === "yes",
            is_branch: locationDataMap.is_branch?.toLowerCase() === "yes",
            address_line1: locationDataMap.address_line_1 || "",
            address_line2: locationDataMap.address_line_2 || "",
            locality: locationDataMap.locality || "",
            city: locationDataMap.city || "",
            country_id: countryId,
            state_id: stateId,
            pincode: pinCodeDetail,
            email: locationDataMap.email || "",
            phone: locationDataMap.phone || "",
            gstin: locationDataMap.gstin || "",
            timezone: locationDataMap.timezone || "",
            status: "active",
            created_at: currentDateTime,
            updated_at: currentDateTime,
          };
          transformedData.push(organizationLocationObj);
        }
      }

      // Process organization_departments sheet if it exists
      if (
        data.organization_departments &&
        data.organization_departments.length >= 3
      ) {
        // Headers are in the second row (index 1)
        const headers = data.organization_departments[1];

        // Keep track of department IDs by type_code and dept_code for parent department mapping
        const deptIdMap = {};

        // First pass: create all department types
        for (
          let rowIndex = 2;
          rowIndex < data.organization_departments.length;
          rowIndex++
        ) {
          const deptData = data.organization_departments[rowIndex];

          // Create a map of header to value for easier access
          const deptDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              deptDataMap[header] = deptData[index];
            }
          });

          // 1. Department Type
          const deptTypeId = generateDeterministicUUID(
            deptDataMap.type_code,
            deptDataMap.type_name
          );

          // Only add department type if it hasn't been added yet
          if (!createdEntities.departmentTypes[deptTypeId]) {
            createdEntities.departmentTypes[deptTypeId] = true;

            const departmentTypeObj = {
              dept_type_id: deptTypeId,
              type_name: deptDataMap.type_name || "",
              type_code: deptDataMap.type_code || "",
              description: deptDataMap.description || "",
              is_active: true,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };
            transformedData.push(departmentTypeObj);
          }

          // Generate and store department ID for later reference
          const deptId = generateDeterministicUUID(
            deptDataMap.type_code,
            deptDataMap.dept_code
          );
          deptIdMap[`${deptDataMap.type_code}-${deptDataMap.dept_code}`] =
            deptId;
        }

        // Second pass: create all departments with proper parent references
        for (
          let rowIndex = 2;
          rowIndex < data.organization_departments.length;
          rowIndex++
        ) {
          const deptData = data.organization_departments[rowIndex];

          // Create a map of header to value for easier access
          const deptDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              deptDataMap[header] = deptData[index];
            }
          });

          // Get organization ID using auth_signatory_designation and cin
          const orgId = generateDeterministicUUID(
            deptDataMap.auth_signatory_designation,
            deptDataMap.cin
          );

          // Get department type ID
          const deptTypeId = generateDeterministicUUID(
            deptDataMap.type_code,
            deptDataMap.type_name
          );

          // Get department ID
          const deptId =
            deptIdMap[`${deptDataMap.type_code}-${deptDataMap.dept_code}`];

          // Determine parent department ID if it exists
          let parentDeptId = null;
          if (
            deptDataMap.parent_dept_type_code &&
            deptDataMap.parent_dept_code
          ) {
            parentDeptId =
              deptIdMap[
                `${deptDataMap.parent_dept_type_code}-${deptDataMap.parent_dept_code}`
              ];
          }

          // Only add department if it hasn't been added yet
          if (!createdEntities.departments[deptId]) {
            createdEntities.departments[deptId] = true;

            const departmentObj = {
              dept_id: deptId,
              org_id: orgId,
              dept_type_id: deptTypeId,
              dept_code: deptDataMap.dept_code || "",
              dept_name: deptDataMap.dept_name || "",
              parent_dept_id: parentDeptId,
              cost_center_code: deptDataMap.cost_center_code || "",
              description: deptDataMap.dept_description || "",
              status: "active",
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };
            transformedData.push(departmentObj);
          }
        }
      }

      // Process employees_data sheet if it exists
      if (data.Employees_data && data.Employees_data.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.Employees_data[1];

        // First pass: create all employment types and job titles
        for (
          let rowIndex = 2;
          rowIndex < data.Employees_data.length;
          rowIndex++
        ) {
          const empData = data.Employees_data[rowIndex];

          // Create a map of header to value for easier access
          const empDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              empDataMap[header] = empData[index];
            }
          });

          // 1. Employment Type
          const employmentTypeId = generateDeterministicUUID(
            empDataMap.type_name,
            empDataMap.type_code
          );

          // Only add employment type if it hasn't been added yet
          if (!createdEntities.employmentTypes[employmentTypeId]) {
            createdEntities.employmentTypes[employmentTypeId] = true;

            const employmentTypeObj = {
              employment_type_id: employmentTypeId,
              type_name: empDataMap.type_name || "",
              type_code: empDataMap.type_code || "",
              description: empDataMap.description || "",
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };
            transformedData.push(employmentTypeObj);
          }

          // 2. Job Title
          const jobTitleId = generateDeterministicUUID(
            empDataMap.title_code,
            empDataMap.grade_level
          );
          const orgId = generateDeterministicUUID(
            empDataMap.auth_signatory_designation,
            empDataMap.cin
          );

          // Only add job title if it hasn't been added yet
          if (!createdEntities.jobTitles[jobTitleId]) {
            createdEntities.jobTitles[jobTitleId] = true;

            const jobTitleObj = {
              job_title_id: jobTitleId,
              org_id: orgId,
              title_name: empDataMap.title_name || "",
              title_code: empDataMap.title_code || "",
              title_description: empDataMap.title_description || "",
              grade_level: parseInt(empDataMap.grade_level) || 0,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };
            transformedData.push(jobTitleObj);
          }
        }

        // Second pass: Create all employees and handle reporting manager references
        // Store employee IDs by employee_number for reference
        const employeeIdsByNumber = {};

        // First create all employees
        for (
          let rowIndex = 2;
          rowIndex < data.Employees_data.length;
          rowIndex++
        ) {
          const empData = data.Employees_data[rowIndex];

          // Create a map of header to value for easier access
          const empDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              empDataMap[header] = empData[index];
            }
          });

          // Generate employee ID
          const employeeId = generateDeterministicUUID(
            empDataMap.employee_number,
            empDataMap.first_name
          );
          employeeIdsByNumber[empDataMap.employee_number] = employeeId;

          // Get org ID
          const orgId = generateDeterministicUUID(
            empDataMap.auth_signatory_designation,
            empDataMap.cin
          );

          // Get employment type ID
          const employmentTypeId = generateDeterministicUUID(
            empDataMap.type_name,
            empDataMap.type_code
          );

          // Get department ID
          const deptId = generateDeterministicUUID(
            empDataMap.dept_type_code,
            empDataMap.dept_code
          );

          // Get work location ID (location_code, city)
          const workLocationId = generateDeterministicUUID(
            empDataMap.work_location_code,
            empDataMap.work_location_city
          );

          // Get job title ID
          const jobTitleId = generateDeterministicUUID(
            empDataMap.title_code,
            empDataMap.grade_level
          );
          let mobileNumber = empDataMap.mobile_number || "";
          mobileNumber = mobileNumber.toString();
          let emergencyContactNumber =
            empDataMap.emergnecy_contact_number || "";
          emergencyContactNumber = emergencyContactNumber.toString();

          // Only add employee if it hasn't been added yet
          if (!createdEntities.employees[employeeId]) {
            createdEntities.employees[employeeId] = true;
            // const reporting_manager_emp_number:
            //     empDataMap.reporting_manager_employee_number || "",
            //   reporting_manager_first_name:
            //     empDataMap.reporting_manager_first_name || "",
            // Store reporting manager information for second pass
            const employeeObj = {
              employee_id: employeeId,
              org_id: orgId,
              employee_number: empDataMap.employee_number || "",
              employment_type_id: employmentTypeId,
              dept_id: deptId,
              work_location_id: workLocationId,
              job_title_id: jobTitleId,
              title: empDataMap.title || "",
              first_name: empDataMap.first_name || "",
              middle_name: empDataMap.middle_name || "",
              last_name: empDataMap.last_name || "",
              display_name: empDataMap.display_name || "",
              date_of_birth: empDataMap.date_of_birth || "",
              gender: empDataMap.gender || "",
              official_email: empDataMap.official_email || "",
              personal_email: empDataMap.personal_email || "",
              // mobile_number: empDataMap.mobile_number || "",
              mobile_number: mobileNumber || "",
              emergency_contact_name: empDataMap.emergency_contact_name || "",
              emergency_contact_relationship:
                empDataMap.emergency_contact_relationship || "",
              // emergency_contact_number:
              // empDataMap.emergnecy_contact_number || "", // Note the typo in the header
              emergency_contact_number: emergencyContactNumber || "",
              date_joined: empDataMap.date_joined || "",
              probation_end_date: empDataMap.probation_end_date || "",
              confirmation_date: empDataMap.confirmation_date || "",
              contract_end_date: empDataMap.contract_end_date || "",
              reporting_manager_emp_number:
                empDataMap.reporting_manager_employee_number || "",
              reporting_manager_first_name:
                empDataMap.reporting_manager_first_name || "",
              reporting_manager_id: null, // Will be populated in the next pass
              notice_period_days: parseInt(empDataMap.notice_period_days) || 0,
              status: "active",
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };
            transformedData.push(employeeObj);
          }
        }

        // Third pass: Update reporting manager IDs
        for (let i = 0; i < transformedData.length; i++) {
          const employee = transformedData[i];

          // Skip non-employee objects
          if (!employee.employee_id) continue;

          // Update reporting manager ID if available
          if (
            employee.reporting_manager_emp_number &&
            employee.reporting_manager_first_name
          ) {
            const managerId =
              employeeIdsByNumber[employee.reporting_manager_emp_number];
            if (managerId) {
              employee.reporting_manager_id = managerId;
            } else if (
              employee.reporting_manager_emp_number &&
              employee.reporting_manager_first_name
            ) {
              // Generate manager ID if not found in employee list
              employee.reporting_manager_id = generateDeterministicUUID(
                employee.reporting_manager_emp_number,
                employee.reporting_manager_first_name
              );
            }
          }
        }
      }

      // Process Emp_personal_details sheet if it exists
      if (data.Emp_personal_details && data.Emp_personal_details.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.Emp_personal_details[1];

        // Create a mapping of employee numbers to employee IDs
        const employeeIdsByNumber = {};
        for (const obj of transformedData) {
          if (obj.employee_id && obj.employee_number) {
            employeeIdsByNumber[obj.employee_number] = obj.employee_id;
          }
        }

        // Process each row of employee personal details
        for (
          let rowIndex = 2;
          rowIndex < data.Emp_personal_details.length;
          rowIndex++
        ) {
          const personalData = data.Emp_personal_details[rowIndex];

          // Create a map of header to value for easier access
          const personalDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              personalDataMap[header] = personalData[index];
            }
          });

          // Skip if employee number is missing
          if (!personalDataMap.employee_number) continue;

          // Get the employee ID using the mapping or generate it if not found
          let employeeId = employeeIdsByNumber[personalDataMap.employee_number];
          if (!employeeId && personalDataMap.employee_first_name) {
            employeeId = generateDeterministicUUID(
              personalDataMap.employee_number,
              personalDataMap.employee_first_name
            );
          }

          // Skip if we can't link to an employee
          if (!employeeId) continue;

          // Generate the employee personal details ID
          const emplPersonalDetId = generateDeterministicUUID(
            personalDataMap.employee_number,
            personalDataMap.father_name || ""
          );

          // Only add if not already added
          if (!createdEntities.employeePersonalDetails[emplPersonalDetId]) {
            createdEntities.employeePersonalDetails[emplPersonalDetId] = true;

            // Handle boolean conversion
            let physicallyChalleneged = null;
            if (
              personalDataMap.physically_challenged === "true" ||
              personalDataMap.physically_challenged === true
            ) {
              physicallyChalleneged = true;
            } else if (
              personalDataMap.physically_challenged === "false" ||
              personalDataMap.physically_challenged === false
            ) {
              physicallyChalleneged = false;
            }

            // Parse social media handles if available
            let socialMediaHandles = null;
            if (personalDataMap.social_media_handles) {
              try {
                // Try to parse as JSON if it's a valid JSON string
                socialMediaHandles = JSON.parse(
                  personalDataMap.social_media_handles
                );
              } catch (e) {
                // If it's not valid JSON, just use the string
                socialMediaHandles = personalDataMap.social_media_handles;
              }
            }

            const residenceNumber = personalDataMap.residence_number
              ? personalDataMap.residence_number.toString()
              : null;

            const employeePersonalDetailObj = {
              empl_personal_det_id: emplPersonalDetId,
              employee_id: employeeId,
              marital_status: personalDataMap.marital_status
                ? personalDataMap.marital_status.toLowerCase()
                : null,
              marriage_date: personalDataMap.marriage_date || null,
              blood_group: personalDataMap.blood_group || null,
              nationality: personalDataMap.nationality || null,
              physically_challenged: physicallyChalleneged,
              disability_details: personalDataMap.disability_details || null,
              father_name: personalDataMap.father_name || null,
              mother_name: personalDataMap.mother_name || null,
              spouse_name: personalDataMap.spouse_name || null,
              spouse_gender: personalDataMap.spouse_gender
                ? personalDataMap.spouse_gender.toLowerCase()
                : null,
              // residence_number: personalDataMap.residence_number || null,
              residence_number: residenceNumber || null,
              social_media_handles: socialMediaHandles,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            transformedData.push(employeePersonalDetailObj);
          }
        }
      }

      // Process Emp_financial_details sheet if it exists
      if (
        data.Emp_financial_details &&
        data.Emp_financial_details.length >= 3
      ) {
        // Headers are in the second row (index 1)
        const headers = data.Emp_financial_details[1];

        // Create a mapping of employee numbers to employee IDs
        const employeeIdsByNumber = {};
        for (const obj of transformedData) {
          if (obj.employee_id && obj.employee_number) {
            employeeIdsByNumber[obj.employee_number] = obj.employee_id;
          }
        }

        // MODIFIED CODE FOR ADDING THE BANK OBJECT(BANK MASTER)
        // First, collect all unique banks to avoid duplicate bank records
        const uniqueBanks = new Map();
        for (
          let rowIndex = 2;
          rowIndex < data.Emp_financial_details.length;
          rowIndex++
        ) {
          const financialData = data.Emp_financial_details[rowIndex];

          // Create a map of header to value for easier access
          const financialDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              financialDataMap[header] = financialData[index];
            }
          });
          const financialBankCode = financialDataMap.bank_code
            ? financialDataMap.bank_code.toString()
            : "";
          if (financialDataMap.bank_type && financialBankCode) {
            const bankId = generateDeterministicUUID(
              financialDataMap.bank_type || "",
              financialBankCode
            );

            if (!uniqueBanks.has(bankId)) {
              uniqueBanks.set(bankId, {
                id: bankId,
                type: financialDataMap.bank_type,
                name: financialDataMap.bank_name,
                code: financialBankCode,
                swift: financialDataMap.swift_code,
              });
            }
          }
        }

        // Add bank information to transformedData if not already in createdEntities
        uniqueBanks.forEach((bank) => {
          if (!createdEntities.banks[bank.id]) {
            createdEntities.banks[bank.id] = true;

            // Create and add bank master object to transformedData
            const currentDateTime = new Date().toISOString();
            const bankMasterObj = {
              bank_id: bank.id,
              bank_type: bank.type || "",
              bank_name: bank.name || "",
              bank_code: bank.code,
              swift_code: bank.swift || "",
              is_active: true,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            transformedData.push(bankMasterObj);
          }
        });
        // Now process each employee's financial details
        for (
          let rowIndex = 2;
          rowIndex < data.Emp_financial_details.length;
          rowIndex++
        ) {
          const financialData = data.Emp_financial_details[rowIndex];

          // Create a map of header to value for easier access
          const financialDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              financialDataMap[header] = financialData[index];
            }
          });

          // Skip if employee number is missing
          if (!financialDataMap.employee_number) continue;

          // Get the employee ID using the mapping or generate it if not found
          let employeeId =
            employeeIdsByNumber[financialDataMap.employee_number];
          if (!employeeId && financialDataMap.employee_first_name) {
            employeeId = generateDeterministicUUID(
              financialDataMap.employee_number,
              financialDataMap.employee_first_name
            );
          }

          // Skip if we can't link to an employee
          if (!employeeId) continue;
          const emplBankCode = financialDataMap.bank_code
            ? financialDataMap.bank_code.toString()
            : "";
          // Generate Bank ID
          const bankId = generateDeterministicUUID(
            financialDataMap.bank_type || "",
            emplBankCode
            // financialDataMap.bank_code || ""
          );

          // Process employee bank details and financial details
          if (financialDataMap.account_number) {
            // Format account number properly (it may be in scientific notation)
            let formattedAccountNumber = financialDataMap.account_number;
            if (
              typeof formattedAccountNumber === "number" ||
              /\d+[eE][+-]?\d+/.test(formattedAccountNumber)
            ) {
              // Convert from scientific notation to string
              formattedAccountNumber = String(Number(formattedAccountNumber));
            }

            // Generate employee bank detail ID
            const employeeBankId = generateDeterministicUUID(
              formattedAccountNumber,
              financialDataMap.employee_number
            );

            // Add employee bank details if not already added
            if (!createdEntities.employeeBankDetails[employeeBankId]) {
              createdEntities.employeeBankDetails[employeeBankId] = true;

              const employeeBankDetailObj = {
                employee_bank_id: employeeBankId,
                employee_id: employeeId,
                bank_id: bankId,
                account_number: formattedAccountNumber,
                account_type: financialDataMap.account_type || null,
                ifsc_code: financialDataMap.ifsc_code || null,
                branch_name: financialDataMap.branch_name || null,
                name_on_account: financialDataMap.name_on_account || null,
                is_primary: true, // Setting as primary by default
                status: "active", // Setting as active by default
                created_at: currentDateTime,
                updated_at: currentDateTime,
              };

              transformedData.push(employeeBankDetailObj);

              // Generate employee financial detail ID
              const emplFinancialId = generateDeterministicUUID(
                financialDataMap.salary_payment_mode || "",
                financialDataMap.pf_number || ""
              );

              // Generate compliance ID
              const complianceId = generateDeterministicUUID(
                financialDataMap.compliance_code || "",
                financialDataMap.org_pf_number || ""
              );

              // Add employee financial details if not already added
              if (!createdEntities.employeeFinancialDetails[emplFinancialId]) {
                createdEntities.employeeFinancialDetails[emplFinancialId] =
                  true;

                // Convert boolean fields
                const pfDetailsAvailable =
                  financialDataMap.pf_details_available === "true" || true
                    ? true
                    : financialDataMap.pf_details_available === "false" || false
                      ? false
                      : null;

                const esiDetailsAvailable =
                  financialDataMap.esi_details_available === "true" || true
                    ? true
                    : financialDataMap.esi_details_available === "false" ||
                        false
                      ? false
                      : null;

                const esiEligible =
                  financialDataMap.esi_eligible === "true" || true
                    ? true
                    : financialDataMap.esi_eligible === "false" || false
                      ? false
                      : null;

                const lwfEligible =
                  financialDataMap.lwf_eligible === "true" || true
                    ? true
                    : financialDataMap.lwf_eligible === "false" || false
                      ? false
                      : null;

                const panAvailable =
                  financialDataMap.pan_available === "true" || true
                    ? true
                    : financialDataMap.pan_available === "false" || false
                      ? false
                      : null;

                const employeeFinancialDetailObj = {
                  empl_financial_id: emplFinancialId,
                  employee_id: employeeId,
                  compliance_id: complianceId,
                  employee_bank_id: employeeBankId,
                  salary_payment_mode:
                    financialDataMap.salary_payment_mode || null,
                  pf_details_available: pfDetailsAvailable,
                  pf_number: financialDataMap.pf_number || null,
                  pf_joining_date: financialDataMap.pf_joining_date || null,
                  employee_contribution_to_pf:
                    financialDataMap.employee_contribution_to_pf || null,
                  uan: financialDataMap.uan || null,
                  esi_details_available: esiDetailsAvailable,
                  esi_eligible: esiEligible,
                  // employer_esi_number:
                  //   financialDataMap.employer_esi_number || null,
                  employer_esi_number: financialDataMap.employer_esi_number
                    ? String(financialDataMap.employer_esi_number) // ✅ Convert to string
                    : null,
                  lwf_eligible: lwfEligible,
                  aadhar_number: financialDataMap.aadhar_number
                    ? String(financialDataMap.aadhar_number)
                    : null,
                  dob_in_aadhar: financialDataMap.dob_in_aadhar || null,
                  full_name_in_aadhar:
                    financialDataMap.full_name_in_aadhar || null,
                  gender_in_aadhar: financialDataMap.gender_in_aadhar
                    ? financialDataMap.gender_in_aadhar.toLowerCase()
                    : null,
                  pan_available: panAvailable,
                  pan_number: financialDataMap.pan_number || null,
                  full_name_in_pan: financialDataMap.full_name_in_pan || null,
                  dob_in_pan: financialDataMap.dob_in_pan || null,
                  parents_name_in_pan:
                    financialDataMap.parent_name_in_pan || null,
                  created_at: currentDateTime,
                  updated_at: currentDateTime,
                };

                transformedData.push(employeeFinancialDetailObj);
              }
            }
          }
        }
      }

      // Process salary_component_master sheet if it exists
      if (
        data.salary_component_master &&
        data.salary_component_master.length >= 3
      ) {
        // Headers are in the second row (index 1)
        const headers = data.salary_component_master[1];

        // Track created salary components to avoid duplicates
        const createdSalaryComponents = {};

        // Process each component row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.salary_component_master.length;
          rowIndex++
        ) {
          const componentData = data.salary_component_master[rowIndex];

          // Create a map of header to value for easier access
          const componentDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              componentDataMap[header] = componentData[index];
            }
          });

          // Skip if component_code or component_category is missing
          if (
            !componentDataMap.component_code ||
            !componentDataMap.component_category
          )
            continue;

          // Generate component ID
          const componentId = generateDeterministicUUID(
            componentDataMap.component_code || "",
            componentDataMap.component_category || ""
          );

          // Generate org ID (using auth_signatory_designation and cin)
          const orgId = generateDeterministicUUID(
            componentDataMap.auth_signatory_designation || "",
            componentDataMap.cin || ""
          );

          // Check if this component has been processed already
          if (!createdSalaryComponents[componentId]) {
            createdSalaryComponents[componentId] = true;

            // Convert boolean fields
            const isTaxable =
              componentDataMap.is_taxable === "true"
                ? true
                : componentDataMap.is_taxable === "false"
                  ? false
                  : false;

            const considerForCtc =
              componentDataMap.consider_for_ctc === "true"
                ? true
                : componentDataMap.consider_for_ctc === "false"
                  ? false
                  : true;

            const considerForEsi =
              componentDataMap.consider_for_esi === "true"
                ? true
                : componentDataMap.consider_for_esi === "false"
                  ? false
                  : false;

            const considerForPf =
              componentDataMap.consider_for_pf === "true"
                ? true
                : componentDataMap.consider_for_pf === "false"
                  ? false
                  : false;

            const considerForBonus =
              componentDataMap.consider_for_bonus === "true"
                ? true
                : componentDataMap.consider_for_bonus === "false"
                  ? false
                  : false;

            // Handle min_value and max_value (converting "null" strings to actual null values)
            // let minValue = componentDataMap.min_value;
            // if (minValue === "null") minValue = null;

            // let maxValue = componentDataMap.max_value;
            // if (maxValue === "null") maxValue = null;
            let minValue = componentDataMap.min_value;
            minValue =
              minValue && minValue !== "null"
                ? parseFloat(minValue).toFixed(2)
                : null;

            let maxValue = componentDataMap.max_value;
            maxValue =
              maxValue && maxValue !== "null"
                ? parseFloat(maxValue).toFixed(2)
                : null;

            // Convert rounding_factor to integer
            let roundingFactor = parseInt(
              componentDataMap.rounding_factor || "0",
              10
            );
            if (isNaN(roundingFactor)) roundingFactor = 0;

            // Create salary component master object
            const salaryComponentMasterObj = {
              component_id: componentId,
              org_id: orgId,
              component_name: componentDataMap.component_name || null,
              component_code: componentDataMap.component_code || null,
              component_category: componentDataMap.component_category || null,
              component_type: componentDataMap.component_type
                ? componentDataMap.component_type.toLowerCase()
                : null,
              calculation_type: componentDataMap.calculation_type || null,
              calculation_basis: componentDataMap.calculation_basis || null,
              calculation_formula: componentDataMap.calculation_formula || null,
              calculation_frequency:
                componentDataMap.calculation_frequency || null,
              is_taxable: isTaxable,
              consider_for_ctc: considerForCtc,
              consider_for_esi: considerForEsi,
              consider_for_pf: considerForPf,
              consider_for_bonus: considerForBonus,
              min_value: minValue,
              max_value: maxValue,
              rounding_factor: roundingFactor,
              print_name: componentDataMap.print_name || null,
              description: componentDataMap.description || null,
              status: "active", // Default status
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            transformedData.push(salaryComponentMasterObj);
          }
        }
      }

      // Process salary_structure sheet if it exists
      if (data.salary_structure && data.salary_structure.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.salary_structure[1];

        // Track created salary structures to avoid duplicates
        const createdSalaryStructures = {};

        // Process each structure row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.salary_structure.length;
          rowIndex++
        ) {
          const structureData = data.salary_structure[rowIndex];

          // Create a map of header to value for easier access
          const structureDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              structureDataMap[header] = structureData[index];
            }
          });

          // Skip if structure_name or structure_code is missing
          if (
            !structureDataMap.structure_name ||
            !structureDataMap.structure_code
          )
            continue;

          // Generate structure ID
          const structureId = generateDeterministicUUID(
            structureDataMap.structure_name || "",
            structureDataMap.structure_code || ""
          );

          // Generate org ID (using auth_signatory_designation and cin)
          const orgId = generateDeterministicUUID(
            structureDataMap.auth_signatory_designation || "",
            structureDataMap.cin || ""
          );

          // Check if this structure has been processed already
          if (!createdSalaryStructures[structureId]) {
            createdSalaryStructures[structureId] = true;

            // Convert boolean fields
            const isDefault =
              structureDataMap.is_default === "TRUE" || true
                ? true
                : structureDataMap.is_default === "FALSE" || false
                  ? false
                  : null;

            // Handle min_ctc and max_ctc (ensuring they are numbers)
            // let minCtc = structureDataMap.min_ctc;
            // if (minCtc && minCtc !== "null") {
            //   minCtc = minCtc.toString();
            // } else {
            //   minCtc = null;
            // }

            // let maxCtc = structureDataMap.max_ctc;
            // if (maxCtc && maxCtc !== "null") {
            //   maxCtc = maxCtc.toString();
            // } else {
            //   maxCtc = null;
            // }
            let minCtc = structureDataMap.min_ctc;
            minCtc =
              minCtc && minCtc !== "null"
                ? parseFloat(minCtc).toFixed(2)
                : null;

            let maxCtc = structureDataMap.max_ctc;
            maxCtc =
              maxCtc && maxCtc !== "null"
                ? parseFloat(maxCtc).toFixed(2)
                : null;

            let effectiveFrom = structureDataMap.effective_from;
            if (effectiveFrom === "null") effectiveFrom = null;

            let effectiveTo = structureDataMap.effective_to;
            if (effectiveTo === "null") effectiveTo = null;

            // Create salary structure object
            const salaryStructureObj = {
              structure_id: structureId,
              org_id: orgId,
              structure_name: structureDataMap.structure_name || null,
              structure_code: structureDataMap.structure_code || null,
              description: structureDataMap.description || null,
              min_ctc: minCtc,
              max_ctc: maxCtc,
              effective_from: effectiveFrom,
              effective_to: effectiveTo,
              is_default: isDefault,
              status: "active", // Default status
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            transformedData.push(salaryStructureObj);
          }
        }
      }

      // Process salary_structure_components sheet if it exists
      if (
        data.salary_structure_components &&
        data.salary_structure_components.length >= 3
      ) {
        // Headers are in the second row (index 1)
        const headers = data.salary_structure_components[1];

        // Track created salary structure components to avoid duplicates
        const createdSalaryStructureComponents = {};

        // Process each component row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.salary_structure_components.length;
          rowIndex++
        ) {
          const componentData = data.salary_structure_components[rowIndex];

          // Create a map of header to value for easier access
          const componentDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              componentDataMap[header] = componentData[index];
            }
          });

          // Skip if structure_code, component_code, or component_category is missing
          if (
            !componentDataMap.structure_code ||
            !componentDataMap.component_code ||
            !componentDataMap.component_category
          )
            continue;

          // Generate structure ID
          const structureId = generateDeterministicUUID(
            componentDataMap.structure_name || "",
            componentDataMap.structure_code || ""
          );

          // Generate component ID
          const componentId = generateDeterministicUUID(
            componentDataMap.component_code || "",
            componentDataMap.component_category || ""
          );

          // Generate structure component ID
          const structureComponentId = generateDeterministicUUID(
            componentDataMap.calculation_priority || "",
            componentDataMap.structure_code || ""
          );

          // Check if this structure component has been processed already
          if (!createdSalaryStructureComponents[structureComponentId]) {
            createdSalaryStructureComponents[structureComponentId] = true;

            // Convert numeric fields
            let calculationPriority = parseInt(
              componentDataMap.calculation_priority || "0",
              10
            );
            if (isNaN(calculationPriority)) calculationPriority = null;

            // Handle percentage fields (converting null strings to actual null values)
            let percentageOfBasic = componentDataMap.percentage_of_basic;
            if (percentageOfBasic === "null") percentageOfBasic = null;

            // let percentageOfCtc = componentDataMap.percentage_of_ctc;
            // if (percentageOfCtc === "null") percentageOfCtc = null;
            const percentageOfCtc =
              componentDataMap.percentage_of_ctc &&
              componentDataMap.percentage_of_ctc !== "null"
                ? parseFloat(componentDataMap.percentage_of_ctc).toFixed(2)
                : null;

            // Handle min_value, max_value, and default_value
            let minValue = componentDataMap.min_value;
            if (minValue === "null") minValue = null;

            let maxValue = componentDataMap.max_value;
            if (maxValue === "null") maxValue = null;

            let defaultValue = componentDataMap.default_value;
            if (defaultValue === "null") defaultValue = null;
            let is_mandatory = null;
            if (
              componentDataMap.is_mandatory === "true" ||
              componentDataMap.is_mandatory === true
            ) {
              is_mandatory = true;
            } else if (
              componentDataMap.is_mandatory === "false" ||
              componentDataMap.is_mandatory === false
            ) {
              is_mandatory = false;
            }

            // Create salary structure component object
            const salaryStructureComponentObj = {
              structure_component_id: structureComponentId,
              structure_id: structureId,
              component_id: componentId,
              calculation_priority: calculationPriority,
              percentage_of_basic: percentageOfBasic,
              percentage_of_ctc: percentageOfCtc,
              min_value: minValue,
              max_value: maxValue,
              default_value: defaultValue,
              is_mandatory: true, // Not provided in the source data
              status: "active", // Default status
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            transformedData.push(salaryStructureComponentObj);
          }
        }
      }

      // Process Employee_salaries sheet if it exists
      if (data.Employee_salaries && data.Employee_salaries.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.Employee_salaries[1];

        // Track created employee salaries to avoid duplicates
        const createdEmployeeSalaries = {};

        // Process each employee salary row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.Employee_salaries.length;
          rowIndex++
        ) {
          const salaryData = data.Employee_salaries[rowIndex];

          // Create a map of header to value for easier access
          const salaryDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              salaryDataMap[header] = salaryData[index];
            }
          });

          // Skip if required fields are missing
          if (!salaryDataMap.employee_number || !salaryDataMap.structure_code)
            continue;

          // Generate unique IDs
          const salaryId = generateDeterministicUUID(
            salaryDataMap.annual_ctc || "",
            salaryDataMap.monthly_ctc || ""
          );

          const employeeId = generateDeterministicUUID(
            salaryDataMap.employee_number || "",
            salaryDataMap.emp_first_name || ""
          );

          const structureId = generateDeterministicUUID(
            salaryDataMap.structure_name || "",
            salaryDataMap.structure_code || ""
          );

          // Check if this employee salary has been processed already
          if (!createdEmployeeSalaries[salaryId]) {
            createdEmployeeSalaries[salaryId] = true;

            // Convert string fields to appropriate types
            // Handle null values for effective_to field
            let effectiveTo = salaryDataMap.effective_to;
            if (effectiveTo === "null") effectiveTo = null;

            // Handle numeric fields
            // let annualCtc = salaryDataMap.annual_ctl;
            // if (annualCtc === "null") annualCtc = null;

            // let monthlyCtc = salaryDataMap.monthly_ctc;
            // if (monthlyCtc === "null") monthlyCtc = null;

            // let basicPercentage = salaryDataMap.basic_percentage;
            // if (basicPercentage === "null") basicPercentage = null;

            // let hraPercentage = salaryDataMap.hra_percentage;
            // if (hraPercentage === "null") hraPercentage = null;
            const annualCtc =
              salaryDataMap.annual_ctc && salaryDataMap.annual_ctc !== "null"
                ? parseFloat(salaryDataMap.annual_ctc).toFixed(2)
                : null;

            const monthlyCtc =
              salaryDataMap.monthly_ctc && salaryDataMap.monthly_ctc !== "null"
                ? parseFloat(salaryDataMap.monthly_ctc).toFixed(2)
                : null;

            const basicPercentage =
              salaryDataMap.basic_percentage &&
              salaryDataMap.basic_percentage !== "null"
                ? parseFloat(salaryDataMap.basic_percentage).toFixed(2)
                : null;

            const hraPercentage =
              salaryDataMap.hra_percentage &&
              salaryDataMap.hra_percentage !== "null"
                ? parseFloat(salaryDataMap.hra_percentage).toFixed(2)
                : null;

            let revisionType = salaryDataMap.revision_type;
            if (revisionType === "null") revisionType = null;

            let revisionReason = salaryDataMap.revision_reason;
            if (revisionReason === "null") revisionReason = null;

            // Create employee salary object with explicit order of properties
            const employeeSalaryObj = {
              salary_id: salaryId,
              employee_id: employeeId,
              structure_id: structureId,
              effective_from: salaryDataMap.effective_from || null,
              effective_to: effectiveTo,
              annual_ctc: annualCtc,
              monthly_ctc: monthlyCtc,
              basic_percent: basicPercentage,
              hra_percent: hraPercentage,
              revision_type: revisionType,
              revision_reason: revisionReason,
              status: "active", // Default status
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Employee Salary Object:",
              JSON.stringify(employeeSalaryObj, null, 2)
            );

            transformedData.push(employeeSalaryObj);
          }
        }
      }

      // Process payroll_cycles sheet if it exists
      if (data.payroll_cycles && data.payroll_cycles.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.payroll_cycles[1];

        // Track created payroll cycles to avoid duplicates
        const createdPayrollCycles = {};

        // Process each payroll cycle row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.payroll_cycles.length;
          rowIndex++
        ) {
          const cycleData = data.payroll_cycles[rowIndex];

          // Create a map of header to value for easier access
          const cycleDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              cycleDataMap[header] = cycleData[index];
            }
          });

          // Skip if required fields are missing
          if (!cycleDataMap.cycle_name) continue;

          // Generate unique IDs
          const cycleId = generateDeterministicUUID(
            cycleDataMap.cycle_name || "",
            cycleDataMap.start_day || ""
          );

          const orgId = generateDeterministicUUID(
            cycleDataMap.auth_signatory_designation || "",
            cycleDataMap.cin || ""
          );

          // Check if this payroll cycle has been processed already
          if (!createdPayrollCycles[cycleId]) {
            createdPayrollCycles[cycleId] = true;

            // Convert string fields to appropriate types
            let startDay = parseInt(cycleDataMap.start_day);
            if (isNaN(startDay)) startDay = null;

            let endDay = parseInt(cycleDataMap.end_day);
            if (isNaN(endDay)) endDay = null;

            let processingDay = parseInt(cycleDataMap.processing_day);
            if (isNaN(processingDay)) processingDay = null;

            let paymentDay = parseInt(cycleDataMap.payment_day);
            if (isNaN(paymentDay)) paymentDay = null;

            // Convert boolean fields
            let considerPreviousMonth = cycleDataMap.consider_previous_month;
            if (
              considerPreviousMonth === "TRUE" ||
              considerPreviousMonth === true
            ) {
              considerPreviousMonth = true;
            } else if (
              considerPreviousMonth === "FALSE" ||
              considerPreviousMonth === false
            ) {
              considerPreviousMonth = false;
            } else {
              considerPreviousMonth = null;
            }

            // Create payroll cycle object
            const payrollCycleObj = {
              cycle_id: cycleId,
              org_id: orgId,
              cycle_name: cycleDataMap.cycle_name || "",
              start_day: startDay,
              end_day: endDay,
              processing_day: processingDay,
              payment_day: paymentDay,
              consider_previous_month: considerPreviousMonth || false,
              is_default: false, // Setting default to true since it's the first entry
              status: "active", // Default status
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Payroll Cycle Object:",
              JSON.stringify(payrollCycleObj, null, 2)
            );

            transformedData.push(payrollCycleObj);
          }
        }
      }

      // Process payroll_run sheet if it exists
      if (data.payroll_run && data.payroll_run.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.payroll_run[1];

        // Track created payroll runs to avoid duplicates
        const createdPayrollRuns = {};

        // Process each payroll run row starting from index 2 (skipping header rows)
        for (let rowIndex = 2; rowIndex < data.payroll_run.length; rowIndex++) {
          const runData = data.payroll_run[rowIndex];

          // Create a map of header to value for easier access
          const runDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              runDataMap[header] = runData[index];
            }
          });

          // Skip if required fields are missing
          if (!runDataMap.run_date || !runDataMap.start_date) continue;

          // Generate unique IDs
          const runId = generateDeterministicUUID(
            runDataMap.run_date || "",
            runDataMap.start_date || ""
          );

          const orgId = generateDeterministicUUID(
            runDataMap.auth_signatory_designation || "",
            runDataMap.cin || ""
          );

          const cycleId = generateDeterministicUUID(
            runDataMap.cycle_name || "",
            runDataMap.cycle_start_day || ""
          );

          const processedById = generateDeterministicUUID(
            runDataMap.processed_by_emp_number || "",
            runDataMap.processed_by_emp_first_name || ""
          );

          const approvedById = generateDeterministicUUID(
            runDataMap.approved_by_emp_number || "",
            runDataMap.approved_by_emp_first_name || ""
          );

          // Check if this payroll run has been processed already
          if (!createdPayrollRuns[runId]) {
            createdPayrollRuns[runId] = true;

            // Convert numeric fields
            let totalEmployees = parseInt(runDataMap.total_employees);
            if (isNaN(totalEmployees)) totalEmployees = null;

            let totalGross = runDataMap.total_gross;
            if (totalGross && typeof totalGross === "string") {
              totalGross = totalGross.replace(/,/g, "");
              totalGross = parseFloat(totalGross);
              if (isNaN(totalGross)) totalGross = null;
            }

            let totalDeductions = runDataMap.total_deductions;
            if (totalDeductions && typeof totalDeductions === "string") {
              totalDeductions = totalDeductions.replace(/,/g, "");
              totalDeductions = parseFloat(totalDeductions);
              if (isNaN(totalDeductions)) totalDeductions = null;
            }

            let totalNetPay = runDataMap.total_net_pay;
            if (totalNetPay && typeof totalNetPay === "string") {
              totalNetPay = totalNetPay.replace(/,/g, "");
              totalNetPay = parseFloat(totalNetPay);
              if (isNaN(totalNetPay)) totalNetPay = null;
            }

            // Convert boolean fields
            let locked = runDataMap.locked;
            if (locked === "TRUE" || locked === true) {
              locked = true;
            } else if (locked === "FALSE" || locked === false) {
              locked = false;
            } else {
              locked = null;
            }
            // Function to convert "DD-MM-YYYY" to ISO 8601 format
            const convertToISOString = (dateStr) => {
              if (!dateStr) return null; // Handle null values

              // Match "DD-MM-YYYY" format
              const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
              const match = dateStr.match(regex);

              if (!match) return null; // Invalid format

              const [_, day, month, year] = match; // Extract day, month, year
              const formattedDate = new Date(
                `${year}-${month}-${day}T00:00:00.000Z`
              ); // Convert to ISO format

              return isNaN(formattedDate) ? null : formattedDate.toISOString();
            };
            // Create payroll run object
            const payrollRunObj = {
              run_id: runId,
              org_id: orgId,
              cycle_id: cycleId,
              run_date: runDataMap.run_date || null,
              start_date: runDataMap.start_date || null,
              end_date: runDataMap.end_date || null,
              total_employees: totalEmployees,
              total_gross: totalGross,
              total_deductions: totalDeductions,
              total_net_pay: totalNetPay,
              status: runDataMap.status || "pending",
              locked: locked,
              processed_by: processedById,
              approved_by: approvedById,
              remarks: runDataMap.remarks || "",
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Payroll Run Object:",
              JSON.stringify(payrollRunObj, null, 2)
            );

            transformedData.push(payrollRunObj);
          }
        }
      }

      // Process policy_modules sheet if it exists
      if (data.policy_modules && data.policy_modules.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.policy_modules[1];

        // Track created policy modules to avoid duplicates
        const createdPolicyModules = {};

        // Process each policy module row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.policy_modules.length;
          rowIndex++
        ) {
          const moduleData = data.policy_modules[rowIndex];

          // Create a map of header to value for easier access
          const moduleDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              moduleDataMap[header] = moduleData[index];
            }
          });

          // Skip if required fields are missing
          if (!moduleDataMap.module_code || !moduleDataMap.module_category)
            continue;

          // Generate unique IDs
          const moduleId = generateDeterministicUUID(
            moduleDataMap.module_code || "",
            moduleDataMap.module_category || ""
          );

          const orgId = generateDeterministicUUID(
            moduleDataMap.auth_signatory_designation || "",
            moduleDataMap.cin || ""
          );

          const createdById = generateDeterministicUUID(
            moduleDataMap.created_by_emp_number || "",
            moduleDataMap.created_by_emp_first_name || ""
          );

          const updatedById = generateDeterministicUUID(
            moduleDataMap.updated_by_emp_number || "",
            moduleDataMap.updated_by_emp_name || ""
          );

          // Check if this policy module has been processed already
          if (!createdPolicyModules[moduleId]) {
            createdPolicyModules[moduleId] = true;

            // Convert boolean fields
            let isMandatory = moduleDataMap.is_mandatory;
            if (isMandatory === "TRUE" || isMandatory === true) {
              isMandatory = true;
            } else if (isMandatory === "FALSE" || isMandatory === false) {
              isMandatory = false;
            } else {
              isMandatory = false;
            }

            // Create policy module object
            const policyModuleObj = {
              module_id: moduleId,
              org_id: orgId,
              module_name: moduleDataMap.module_name || "",
              module_code: moduleDataMap.module_code || "",
              module_category: moduleDataMap.module_category || "",
              module_description: moduleDataMap.module_description || "",
              version: moduleDataMap.version || "1.0.0",
              is_mandatory: isMandatory,
              status: moduleDataMap.status || "active", // Default status if missing
              effective_from: moduleDataMap.effective_from || null,
              effective_to: moduleDataMap.effective_to || null,
              created_by: createdById,
              updated_by: updatedById,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Policy Module Object:",
              JSON.stringify(policyModuleObj, null, 2)
            );

            transformedData.push(policyModuleObj);
          }
        }
      }

      // // Process policy_setting sheet if it exists
      // if (data.policy_setting && data.policy_setting.length >= 3) {
      //   // Headers are in the second row (index 1)
      //   const headers = data.policy_setting[1];

      //   // Track created policy settings to avoid duplicates
      //   const createdPolicySettings = {};

      //   // Process each policy setting row starting from index 2 (skipping header rows)
      //   for (
      //     let rowIndex = 2;
      //     rowIndex < data.policy_setting.length;
      //     rowIndex++
      //   ) {
      //     const settingData = data.policy_setting[rowIndex];

      //     // Create a map of header to value for easier access
      //     const settingDataMap = {};
      //     headers.forEach((header, index) => {
      //       if (header) {
      //         settingDataMap[header] = settingData[index];
      //       }
      //     });

      //     // Skip if required fields are missing
      //     if (!settingDataMap.setting_name || !settingDataMap.setting_key)
      //       continue;

      //     // Generate unique IDs
      //     const settingId = generateDeterministicUUID(
      //       settingDataMap.setting_name || "",
      //       settingDataMap.setting_key || ""
      //     );

      //     const moduleId = generateDeterministicUUID(
      //       settingDataMap.module_code || "",
      //       settingDataMap.module_category || ""
      //     );

      //     const orgId = generateDeterministicUUID(
      //       settingDataMap.auth_signatory_designation || "",
      //       settingDataMap.cin || ""
      //     );

      //     const createdById = generateDeterministicUUID(
      //       settingDataMap.created_by_emp_number || "",
      //       settingDataMap.created_by_emp_first_name || ""
      //     );

      //     const updatedById = generateDeterministicUUID(
      //       settingDataMap.updated_by_emp_number || "",
      //       settingDataMap.updated_by_emp_first_name || ""
      //     );

      //     // Check if this policy setting has been processed already
      //     if (!createdPolicySettings[settingId]) {
      //       createdPolicySettings[settingId] = true;

      //       // Convert boolean fields
      //       let isEncrypted = settingDataMap.is_encrypted;
      //       if (isEncrypted === "TRUE" || isEncrypted === true) {
      //         isEncrypted = true;
      //       } else if (isEncrypted === "FALSE" || isEncrypted === false) {
      //         isEncrypted = false;
      //       } else {
      //         isEncrypted = false;
      //       }

      //       let isConfigurable = settingDataMap.is_configurable;
      //       if (isConfigurable === "TRUE" || isConfigurable === true) {
      //         isConfigurable = true;
      //       } else if (isConfigurable === "FALSE" || isConfigurable === false) {
      //         isConfigurable = false;
      //       } else {
      //         isConfigurable = true;
      //       }

      //       // Create policy setting object
      //       const policySettingObj = {
      //         setting_id: settingId,
      //         module_id: moduleId,
      //         org_id: orgId,
      //         setting_name: settingDataMap.setting_name || "",
      //         setting_key: settingDataMap.setting_key || "",
      //         setting_value: settingDataMap.setting_value || null,
      //         setting_type: settingDataMap.setting_type || "",
      //         is_encrypted: isEncrypted,
      //         is_configurable: isConfigurable,
      //         validation_rules: settingDataMap.validation_rules || null,
      //         default_value: settingDataMap.default_value || null,
      //         description: settingDataMap.description || "",
      //         status: settingDataMap.status || "active", // Default status if missing
      //         created_by: createdById,
      //         updated_by: updatedById,
      //         created_at: currentDateTime,
      //         updated_at: currentDateTime,
      //       };

      //       // Debug log to verify the object has all required fields
      //       console.log(
      //         "Policy Setting Object:",
      //         JSON.stringify(policySettingObj, null, 2)
      //       );

      //       transformedData.push(policySettingObj);
      //     }
      //   }
      // }

      // Process policy_setting sheet if it exists
      if (data.policy_setting && data.policy_setting.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.policy_setting[1];

        // Track created policy settings to avoid duplicates
        const createdPolicySettings = {};

        // Process each policy setting row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.policy_setting.length;
          rowIndex++
        ) {
          const settingData = data.policy_setting[rowIndex];

          // Create a map of header to value for easier access
          const settingDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              settingDataMap[header] = settingData[index];
            }
          });

          // Skip if required fields are missing
          if (!settingDataMap.setting_name || !settingDataMap.setting_key)
            continue;

          // Generate unique IDs
          const settingId = generateDeterministicUUID(
            settingDataMap.setting_name || "",
            settingDataMap.setting_key || ""
          );

          const moduleId = generateDeterministicUUID(
            settingDataMap.module_code || "",
            settingDataMap.module_category || ""
          );

          const orgId = generateDeterministicUUID(
            settingDataMap.auth_signatory_designation || "",
            settingDataMap.cin || ""
          );

          const createdById = generateDeterministicUUID(
            settingDataMap.created_by_emp_number || "",
            settingDataMap.created_by_emp_first_name || ""
          );

          const updatedById = generateDeterministicUUID(
            settingDataMap.updated_by_emp_number || "",
            settingDataMap.updated_by_emp_first_name || ""
          );

          // Check if this policy setting has been processed already
          if (!createdPolicySettings[settingId]) {
            createdPolicySettings[settingId] = true;

            // Convert boolean fields
            let isEncrypted = settingDataMap.is_encrypted;
            if (isEncrypted === "TRUE" || isEncrypted === true) {
              isEncrypted = true;
            } else if (isEncrypted === "FALSE" || isEncrypted === false) {
              isEncrypted = false;
            } else {
              isEncrypted = false;
            }

            let isConfigurable = settingDataMap.is_configurable;
            if (isConfigurable === "TRUE" || isConfigurable === true) {
              isConfigurable = true;
            } else if (isConfigurable === "FALSE" || isConfigurable === false) {
              isConfigurable = false;
            } else {
              isConfigurable = true;
            }

            // Parse JSON fields
            let settingValue = null;
            let validationRules = null;
            let defaultValue = null;

            // Process setting_value
            if (settingDataMap.setting_value) {
              try {
                // First try to parse as JSON directly
                settingValue = JSON.parse(settingDataMap.setting_value);
              } catch (e) {
                // If that fails, try to convert JS object notation to valid JSON
                try {
                  // Replace single quotes with double quotes
                  let jsonStr = settingDataMap.setting_value.replace(/'/g, '"');
                  // Add double quotes to keys without quotes
                  jsonStr = jsonStr.replace(
                    /(\s*?{\s*?|\s*?,\s*?)(['"])?([a-zA-Z0-9_]+)(['"])?:/g,
                    '$1"$3":'
                  );
                  // Remove trailing spaces inside the object
                  jsonStr = jsonStr.replace(/}\s+$/, "}");
                  settingValue = JSON.parse(jsonStr);
                } catch (e2) {
                  console.error(
                    `Failed to parse setting_value: ${settingDataMap.setting_value}`
                  );
                  // Fallback to a default valid JSON object
                  settingValue = { value: null };
                }
              }
            }

            // Process validation_rules
            if (settingDataMap.validation_rules) {
              try {
                validationRules = JSON.parse(settingDataMap.validation_rules);
              } catch (e) {
                try {
                  // Replace single quotes with double quotes
                  let jsonStr = settingDataMap.validation_rules.replace(
                    /'/g,
                    '"'
                  );
                  // Add double quotes to keys without quotes
                  jsonStr = jsonStr.replace(
                    /(\s*?{\s*?|\s*?,\s*?)(['"])?([a-zA-Z0-9_]+)(['"])?:/g,
                    '$1"$3":'
                  );
                  // Remove trailing spaces inside the object
                  jsonStr = jsonStr.replace(/}\s+$/, "}");
                  validationRules = JSON.parse(jsonStr);
                } catch (e2) {
                  console.error(
                    `Failed to parse validation_rules: ${settingDataMap.validation_rules}`
                  );
                  validationRules = null;
                }
              }
            }

            // Process default_value
            if (settingDataMap.default_value) {
              try {
                defaultValue = JSON.parse(settingDataMap.default_value);
              } catch (e) {
                try {
                  // Replace single quotes with double quotes
                  let jsonStr = settingDataMap.default_value.replace(/'/g, '"');
                  // Add double quotes to keys without quotes
                  jsonStr = jsonStr.replace(
                    /(\s*?{\s*?|\s*?,\s*?)(['"])?([a-zA-Z0-9_]+)(['"])?:/g,
                    '$1"$3":'
                  );
                  // Remove trailing spaces inside the object
                  jsonStr = jsonStr.replace(/}\s+$/, "}");
                  defaultValue = JSON.parse(jsonStr);
                } catch (e2) {
                  console.error(
                    `Failed to parse default_value: ${settingDataMap.default_value}`
                  );
                  defaultValue = null;
                }
              }
            }

            // Create policy setting object
            const policySettingObj = {
              setting_id: settingId,
              module_id: moduleId,
              org_id: orgId,
              setting_name: settingDataMap.setting_name || "",
              setting_key: settingDataMap.setting_key || "",
              setting_value: settingValue, // Now a proper JSON object
              setting_type: settingDataMap.setting_type?.toLowerCase() || "",
              is_encrypted: isEncrypted,
              is_configurable: isConfigurable,
              validation_rules: validationRules, // Now a proper JSON object
              default_value: defaultValue, // Now a proper JSON object
              description: settingDataMap.description || "",
              status: settingDataMap.status || "active", // Default status if missing
              created_by: createdById,
              updated_by: updatedById,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Policy Setting Object:",
              JSON.stringify(policySettingObj, null, 2)
            );

            transformedData.push(policySettingObj);
          }
        }
      }

      // Process probation_policies sheet if it exists
      if (data.probation_policies && data.probation_policies.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.probation_policies[1];

        // Track created probation policies to avoid duplicates
        const createdProbationPolicies = {};

        // Process each probation policy row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.probation_policies.length;
          rowIndex++
        ) {
          const policyData = data.probation_policies[rowIndex];

          // Create a map of header to value for easier access
          const policyDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              policyDataMap[header] = policyData[index];
            }
          });

          // Skip if required fields are missing
          if (
            !policyDataMap.probation_code ||
            !policyDataMap.probation_period_months
          )
            continue;

          // Generate unique IDs
          const policyId = generateDeterministicUUID(
            policyDataMap.probation_period_months || "",
            policyDataMap.probation_code || ""
          );

          const orgId = generateDeterministicUUID(
            policyDataMap.auth_signatory_designation || "",
            policyDataMap.cin || ""
          );

          const employmentTypeId = generateDeterministicUUID(
            policyDataMap.employement_type_name || "",
            policyDataMap.employment_type_code || ""
          );

          const employeeId = generateDeterministicUUID(
            policyDataMap.employee_number || "",
            policyDataMap.employee_first_name || ""
          );

          const deptId = generateDeterministicUUID(
            policyDataMap.dept_type_code || "",
            policyDataMap.dept_code || ""
          );

          const createdById = generateDeterministicUUID(
            policyDataMap.created_by_emp_number || "",
            policyDataMap.created_by_emp_first_name || ""
          );

          const updatedById = generateDeterministicUUID(
            policyDataMap.updated_by_emp_number || "",
            policyDataMap.updated_by_emp_first_name || ""
          );

          // Check if this probation policy has been processed already
          if (!createdProbationPolicies[policyId]) {
            createdProbationPolicies[policyId] = true;

            // Convert boolean fields
            let extensionAllowed = policyDataMap.extension_allowed;
            if (extensionAllowed === "TRUE" || extensionAllowed === true) {
              extensionAllowed = true;
            } else if (
              extensionAllowed === "FALSE" ||
              extensionAllowed === false
            ) {
              extensionAllowed = false;
            } else {
              extensionAllowed = true;
            }

            let autoConfirm = policyDataMap.auto_confirm;
            if (autoConfirm === "TRUE" || autoConfirm === true) {
              autoConfirm = true;
            } else if (autoConfirm === "FALSE" || autoConfirm === false) {
              autoConfirm = false;
            } else {
              autoConfirm = false;
            }

            let reviewRequired = policyDataMap.review_required;
            if (reviewRequired === "TRUE" || reviewRequired === true) {
              reviewRequired = true;
            } else if (reviewRequired === "FALSE" || reviewRequired === false) {
              reviewRequired = false;
            } else {
              reviewRequired = true;
            }

            // Convert numeric fields
            const probationPeriodMonths =
              parseInt(policyDataMap.probation_period_months) || null;
            const minExtensionMonths =
              parseInt(policyDataMap.min_extension_months) || null;
            const maxExtensionMonths =
              parseInt(policyDataMap.max_extension_months) || null;
            const maxExtensions =
              parseInt(policyDataMap.max_extensions) || null;
            const noticePeriodDays =
              parseInt(policyDataMap.notice_period_days) || null;
            const reviewBeforeDays =
              parseInt(policyDataMap.review_before_days) || null;

            // Create probation policy object
            const probationPolicyObj = {
              policy_id: policyId,
              org_id: orgId,
              employment_type_id: employmentTypeId,
              employee_id: employeeId,
              dept_id: deptId,
              probation_code: policyDataMap.probation_code || "",
              probation_period_months: probationPeriodMonths,
              min_extension_months: minExtensionMonths,
              max_extension_months: maxExtensionMonths,
              extension_allowed: extensionAllowed,
              max_extensions: maxExtensions,
              auto_confirm: autoConfirm,
              notice_period_days: noticePeriodDays,
              review_required: reviewRequired,
              review_before_days: reviewBeforeDays,
              status: policyDataMap.status || "active", // Default status if missing
              created_by: createdById,
              updated_by: updatedById,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Probation Policy Object:",
              JSON.stringify(probationPolicyObj, null, 2)
            );

            transformedData.push(probationPolicyObj);
          }
        }
      }

      // Process policy_document_versions sheet if it exists
      if (
        data.policy_document_versions &&
        data.policy_document_versions.length >= 3
      ) {
        // Headers are in the second row (index 1)
        const headers = data.policy_document_versions[1];

        // Track created policy document versions to avoid duplicates
        const createdPolicyDocumentVersions = {};

        // Process each policy document version row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.policy_document_versions.length;
          rowIndex++
        ) {
          const versionData = data.policy_document_versions[rowIndex];

          // Create a map of header to value for easier access
          const versionDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              versionDataMap[header] = versionData[index];
            }
          });

          // Skip if required fields are missing
          if (!versionDataMap.module_code || !versionDataMap.version_number)
            continue;

          // Generate unique IDs
          const versionId = generateDeterministicUUID(
            versionDataMap.module_code || "",
            versionDataMap.version_number || ""
          );

          const moduleId = generateDeterministicUUID(
            versionDataMap.module_code || "",
            versionDataMap.module_category || ""
          );

          const approvedById = generateDeterministicUUID(
            versionDataMap.approved_by_emp_number || "",
            versionDataMap.approved_by_emp_first_name || ""
          );

          const createdById = generateDeterministicUUID(
            versionDataMap.created_by_emp_number || "",
            versionDataMap.created_by_emp_first_name || ""
          );

          const updatedById = generateDeterministicUUID(
            versionDataMap.updated_by_emp_number || "",
            versionDataMap.updated_by_emp_first_name || ""
          );

          // Check if this policy document version has been processed already
          if (!createdPolicyDocumentVersions[versionId]) {
            createdPolicyDocumentVersions[versionId] = true;

            // Create policy document version object
            const policyDocumentVersionObj = {
              version_id: versionId,
              module_id: moduleId,
              version_number: versionDataMap.version_number || "",
              document_url: versionDataMap.document_url || "",
              change_summary: versionDataMap.change_summary || "",
              status: versionDataMap.status || "active", // Default status if missing
              effective_from: versionDataMap.effective_from || null,
              effective_to: versionDataMap.effective_to || null,
              approved_at: versionDataMap.approved_at || null,
              approved_by: approvedById,
              created_by: createdById,
              updated_by: updatedById,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Policy Document Version Object:",
              JSON.stringify(policyDocumentVersionObj, null, 2)
            );

            transformedData.push(policyDocumentVersionObj);
          }
        }
      }

      // Process policy_acknowledgement sheet if it exists
      if (
        data.policy_acknowledgement &&
        data.policy_acknowledgement.length >= 3
      ) {
        // Headers are in the second row (index 1)
        const headers = data.policy_acknowledgement[1];

        // Track created policy acknowledgements to avoid duplicates
        const createdPolicyAcknowledgements = {};

        // Process each policy acknowledgement row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.policy_acknowledgement.length;
          rowIndex++
        ) {
          const acknowledgementData = data.policy_acknowledgement[rowIndex];

          // Create a map of header to value for easier access
          const acknowledgementDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              acknowledgementDataMap[header] = acknowledgementData[index];
            }
          });

          // Skip if required fields are missing
          if (
            !acknowledgementDataMap.employee_number ||
            !acknowledgementDataMap.module_code
          )
            continue;

          // Generate unique IDs
          const acknowledgementId = generateDeterministicUUID(
            acknowledgementDataMap.employee_number || "",
            acknowledgementDataMap.acknowledgement_type || ""
          );

          const versionId = generateDeterministicUUID(
            acknowledgementDataMap.module_code || "",
            acknowledgementDataMap.version_number || ""
          );

          const employeeId = generateDeterministicUUID(
            acknowledgementDataMap.employee_number || "",
            acknowledgementDataMap.emp_first_name || ""
          );

          // Check if this policy acknowledgement has been processed already
          if (!createdPolicyAcknowledgements[acknowledgementId]) {
            createdPolicyAcknowledgements[acknowledgementId] = true;

            // Create policy acknowledgement object
            const policyAcknowledgementObj = {
              acknowledgment_id: acknowledgementId,
              version_id: versionId,
              employee_id: employeeId,
              acknowledged_at:
                acknowledgementDataMap.acknowledged_at || currentDateTime,
              acknowledgment_type:
                acknowledgementDataMap.acknowledgement_type || "",
              ip_address: acknowledgementDataMap.ip_address || "",
              user_agent: acknowledgementDataMap.user_agent || "",
              comments: acknowledgementDataMap.comments || "",
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Policy Acknowledgement Object:",
              JSON.stringify(policyAcknowledgementObj, null, 2)
            );

            transformedData.push(policyAcknowledgementObj);
          }
        }
      }

      // Process leave_policy_configuration sheet if it exists
      if (
        data.leave_policy_configuration &&
        data.leave_policy_configuration.length >= 3
      ) {
        // Headers are in the second row (index 1)
        const headers = data.leave_policy_configuration[1];

        // Track created leave policy configurations to avoid duplicates
        const createdLeavePolicyConfigurations = {};

        // Process each leave policy configuration row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.leave_policy_configuration.length;
          rowIndex++
        ) {
          const configData = data.leave_policy_configuration[rowIndex];

          // Create a map of header to value for easier access
          const configDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              configDataMap[header] = configData[index];
            }
          });

          // Skip if required fields are missing
          if (!configDataMap.leave_type || !configDataMap.module_code) continue;

          // Generate unique IDs
          const configId = generateDeterministicUUID(
            configDataMap.leave_type || "",
            configDataMap.accural_frequency || ""
          );

          const moduleId = generateDeterministicUUID(
            configDataMap.module_code || "",
            configDataMap.module_category || ""
          );

          const orgId = generateDeterministicUUID(
            configDataMap.auth_signatory_designation || "",
            configDataMap.cin || ""
          );

          const createdById = generateDeterministicUUID(
            configDataMap.created_by_emp_number || "",
            configDataMap.created_by_emp_first_name || ""
          );

          const updatedById = generateDeterministicUUID(
            configDataMap.updated_by_emp_number || "",
            configDataMap.updated_by_emp_first_name || ""
          );

          // Check if this leave policy configuration has been processed already
          if (!createdLeavePolicyConfigurations[configId]) {
            createdLeavePolicyConfigurations[configId] = true;

            // Convert boolean fields
            let isEncashable = configDataMap.is_encashable;
            if (isEncashable === "TRUE" || isEncashable === true) {
              isEncashable = true;
            } else if (isEncashable === "FALSE" || isEncashable === false) {
              isEncashable = false;
            } else {
              isEncashable = false;
            }

            let requiresApproval = configDataMap.requires_approval;
            if (requiresApproval === "TRUE" || requiresApproval === true) {
              requiresApproval = true;
            } else if (
              requiresApproval === "FALSE" ||
              requiresApproval === false
            ) {
              requiresApproval = false;
            } else {
              requiresApproval = true;
            }

            let requiresDocuments = configDataMap.requires_documents;
            if (requiresDocuments === "TRUE" || requiresDocuments === true) {
              requiresDocuments = true;
            } else if (
              requiresDocuments === "FALSE" ||
              requiresDocuments === false
            ) {
              requiresDocuments = false;
            } else {
              requiresDocuments = false;
            }

            let prorataBasis = configDataMap.prorata_basis;
            if (prorataBasis === "TRUE" || prorataBasis === true) {
              prorataBasis = true;
            } else if (prorataBasis === "FALSE" || prorataBasis === false) {
              prorataBasis = false;
            } else {
              prorataBasis = true;
            }

            // Convert numeric fields
            const daysPerYear = parseFloat(configDataMap.days_per_year) || null;
            const minDaysPerRequest =
              parseInt(configDataMap.min_days_per_request) || null;
            const maxDaysPerRequest =
              parseInt(configDataMap.max_days_per_request) || null;
            const minNoticeDays =
              parseInt(configDataMap.min_notice_days) || null;
            const maxCarryForwardDays =
              parseInt(configDataMap.max_carry_forward_days) || null;
            const carryForwardValidityMonths =
              parseInt(configDataMap.carry_forward_validity_months) || null;
            const encashmentLimit =
              parseInt(configDataMap.encashment_limit) || 0;
            const documentSubmissionDays =
              parseInt(configDataMap.document_submission_days) || 0;
            const applicableFromMonths =
              parseInt(configDataMap.applicable_from_months) || 0;

            // Create leave policy configuration object
            const leavePolicyConfigObj = {
              config_id: configId,
              module_id: moduleId,
              org_id: orgId,
              leave_type: configDataMap.leave_type || "",
              accrual_frequency: configDataMap.accural_frequency || "",
              days_per_year: daysPerYear,
              min_days_per_request: minDaysPerRequest,
              max_days_per_request: maxDaysPerRequest,
              min_notice_days: minNoticeDays,
              max_carry_forward_days: maxCarryForwardDays,
              carry_forward_validity_months: carryForwardValidityMonths,
              is_encashable: isEncashable,
              encashment_limit: encashmentLimit,
              requires_approval: requiresApproval,
              requires_documents: requiresDocuments,
              document_submission_days: documentSubmissionDays,
              applicable_from_months: applicableFromMonths,
              prorata_basis: prorataBasis,
              status: configDataMap.status || "active", // Default status if missing
              created_by: createdById,
              updated_by: updatedById,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Leave Policy Configuration Object:",
              JSON.stringify(leavePolicyConfigObj, null, 2)
            );

            transformedData.push(leavePolicyConfigObj);
          }
        }
      }

      // Process holiday_master_details sheet if it exists
      if (
        data.holiday_master_details &&
        data.holiday_master_details.length >= 3
      ) {
        // Headers are in the second row (index 1)
        const headers = data.holiday_master_details[1];

        // Track created holiday calendar, holiday masters, and holiday calendar details to avoid duplicates
        const createdHolidayCalendars = {};
        const createdHolidayMasters = {};
        const createdHolidayCalendarDetails = {};

        // Process each holiday master detail row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.holiday_master_details.length;
          rowIndex++
        ) {
          const holidayData = data.holiday_master_details[rowIndex];

          // Create a map of header to value for easier access
          const holidayDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              holidayDataMap[header] = holidayData[index];
            }
          });

          // Skip if required fields are missing
          if (
            !holidayDataMap.year ||
            !holidayDataMap.start_date ||
            !holidayDataMap.holiday_name ||
            !holidayDataMap.holiday_type ||
            !holidayDataMap.holiday_date
          )
            continue;

          // Generate unique IDs
          const orgId = generateDeterministicUUID(
            holidayDataMap.auth_signatory_designation || "",
            holidayDataMap.cin || ""
          );

          // Generate IDs for HolidayCalendarYear
          const calendarId = generateDeterministicUUID(
            holidayDataMap.year || "",
            holidayDataMap.start_date || ""
          );

          // Generate IDs for HolidayMaster
          const holidayId = generateDeterministicUUID(
            holidayDataMap.holiday_name || "",
            holidayDataMap.holiday_type || ""
          );

          // Generate IDs for HolidayCalendarDetails
          const calendarDetailId = generateDeterministicUUID(
            holidayDataMap.holiday_date || "",
            holidayDataMap.is_half_day || ""
          );

          // Process HolidayCalendarYear if not already created
          if (!createdHolidayCalendars[calendarId]) {
            createdHolidayCalendars[calendarId] = true;

            // Convert year to integer
            const year = parseInt(holidayDataMap.year) || null;

            // Create holiday calendar year object
            const holidayCalendarYearObj = {
              calendar_id: calendarId,
              org_id: orgId,
              year: year,
              start_date: holidayDataMap.start_date || null,
              end_date: holidayDataMap.end_date || null,
              status: "active", // Default status if missing
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Holiday Calendar Year Object:",
              JSON.stringify(holidayCalendarYearObj, null, 2)
            );

            transformedData.push(holidayCalendarYearObj);
          }

          // Process HolidayMaster if not already created
          if (!createdHolidayMasters[holidayId]) {
            createdHolidayMasters[holidayId] = true;

            // Create holiday master object
            const holidayMasterObj = {
              holiday_id: holidayId,
              org_id: orgId,
              holiday_name: holidayDataMap.holiday_name || "",
              holiday_type: holidayDataMap.holiday_type || "",
              recurrence_type: holidayDataMap.recurrence_type || "",
              description: holidayDataMap.description || "",
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Holiday Master Object:",
              JSON.stringify(holidayMasterObj, null, 2)
            );

            transformedData.push(holidayMasterObj);
          }

          // Process HolidayCalendarDetails for each row (these will be unique per row)
          if (!createdHolidayCalendarDetails[calendarDetailId]) {
            createdHolidayCalendarDetails[calendarDetailId] = true;

            // Convert boolean fields
            let isHalfDay = holidayDataMap.is_half_day;
            if (isHalfDay === "TRUE" || isHalfDay === true) {
              isHalfDay = true;
            } else if (isHalfDay === "FALSE" || isHalfDay === false) {
              isHalfDay = false;
            } else {
              isHalfDay = false;
            }

            // Handle half day type
            let halfDayType = holidayDataMap.half_day_type;
            if (halfDayType === "FALSE" || halfDayType === "false") {
              halfDayType = null;
            }

            // Create holiday calendar details object
            const holidayCalendarDetailsObj = {
              calendar_detail_id: calendarDetailId,
              calendar_id: calendarId,
              holiday_id: holidayId,
              holiday_date: holidayDataMap.holiday_date || null,
              is_half_day: isHalfDay,
              half_day_type: halfDayType,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Holiday Calendar Details Object:",
              JSON.stringify(holidayCalendarDetailsObj, null, 2)
            );

            transformedData.push(holidayCalendarDetailsObj);
          }
        }
      }

      /**
       * This file contains the implementation for transforming attendance_managment sheet data
       * to be integrated into the etlService.js file
       */

      // Copy and paste this implementation into etlService.js
      // after the holiday_master_details processing section, before the writeFile call

      // Process attendance_managment sheet if it exists (note the spelling in the Excel sheet)
      if (data.attendance_managment && data.attendance_managment.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.attendance_managment[1];

        // Track created attendance settings to avoid duplicates
        const createdAttendanceSettings = {};

        // Process each attendance management row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.attendance_managment.length;
          rowIndex++
        ) {
          const attendanceData = data.attendance_managment[rowIndex];

          // Create a map of header to value for easier access
          const attendanceDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              attendanceDataMap[header] = attendanceData[index];
            }
          });

          // Skip if required fields are missing
          if (!attendanceDataMap.shift_type || !attendanceDataMap.module_code)
            continue;

          // Generate unique IDs
          const id = generateDeterministicUUID(
            attendanceDataMap.shift_type || "",
            attendanceDataMap.capture_method || ""
          );

          const orgId = generateDeterministicUUID(
            attendanceDataMap.auth_signatory_designation || "",
            attendanceDataMap.cin || ""
          );

          const moduleId = generateDeterministicUUID(
            attendanceDataMap.module_code || "",
            attendanceDataMap.module_category || ""
          );

          const createdById = generateDeterministicUUID(
            attendanceDataMap.created_by_emp_number || "",
            attendanceDataMap.created_by_emp_first_name || ""
          );

          const updatedById = generateDeterministicUUID(
            attendanceDataMap.updated_by_emp_number || "",
            attendanceDataMap.updated_by_emp_first_name || ""
          );

          // Check if this attendance setting has been processed already
          if (!createdAttendanceSettings[id]) {
            createdAttendanceSettings[id] = true;

            // Convert boolean fields
            let geoFencingEnabled = attendanceDataMap.geo_fencing_enabled;
            if (geoFencingEnabled === "TRUE" || geoFencingEnabled === true) {
              geoFencingEnabled = true;
            } else if (
              geoFencingEnabled === "FALSE" ||
              geoFencingEnabled === false
            ) {
              geoFencingEnabled = false;
            } else {
              geoFencingEnabled = false;
            }

            let overtimePolicyEnabled =
              attendanceDataMap.overtime_policy_enabled;
            if (
              overtimePolicyEnabled === "TRUE" ||
              overtimePolicyEnabled === true
            ) {
              overtimePolicyEnabled = true;
            } else if (
              overtimePolicyEnabled === "FALSE" ||
              overtimePolicyEnabled === false
            ) {
              overtimePolicyEnabled = false;
            } else {
              overtimePolicyEnabled = false;
            }

            let autoCheckoutEnabled = attendanceDataMap.auto_checkout_enabled;
            if (
              autoCheckoutEnabled === "TRUE" ||
              autoCheckoutEnabled === true
            ) {
              autoCheckoutEnabled = true;
            } else if (
              autoCheckoutEnabled === "FALSE" ||
              autoCheckoutEnabled === false
            ) {
              autoCheckoutEnabled = false;
            } else {
              autoCheckoutEnabled = false;
            }

            let regularizationAllowed =
              attendanceDataMap.regularization_allowed;
            if (
              regularizationAllowed === "TRUE" ||
              regularizationAllowed === true
            ) {
              regularizationAllowed = true;
            } else if (
              regularizationAllowed === "FALSE" ||
              regularizationAllowed === false
            ) {
              regularizationAllowed = false;
            } else {
              regularizationAllowed = true;
            }

            // Convert numeric fields
            const geoFenceRadius =
              parseInt(attendanceDataMap.geo_fence_radius) || null;
            const gracePeriodMinutes =
              parseInt(attendanceDataMap.grace_period_minutes) || null;
            const halfDayHours =
              parseInt(attendanceDataMap.half_day_hours) || null;
            const fullDayHours =
              parseFloat(attendanceDataMap.full_day_hours) || null;
            const breakDurationMinutes =
              parseInt(attendanceDataMap.break_duration_minutes) || null;
            const workDaysPerWeek =
              parseInt(attendanceDataMap.work_days_per_week) || null;
            const minimumOvertimeMinutes =
              parseInt(attendanceDataMap.minimum_overtime_minutes) || null;
            const maxOvertimeHoursMonthly =
              parseInt(attendanceDataMap.max_overtime_hours_monthly) || null;
            const regularizationWindowDays =
              parseInt(attendanceDataMap.regularization_window_days) || null;
            const regularizationLimitMonthly =
              parseInt(attendanceDataMap.regularization_limit_monthly) || null;
            const weekendOvertimeMultiplier =
              parseFloat(attendanceDataMap.weekend_overtime_multiplier) || null;
            const holidayOvertimeMultiplier =
              parseFloat(attendanceDataMap.holiday_overtime_multiplier) || null;
            const flexibleHours =
              parseInt(attendanceDataMap.flexible_hours) || null;

            // Create attendance setting object
            const attendanceSettingObj = {
              id: id,
              organizationId: orgId,
              moduleId: moduleId,
              // captureMethods: attendanceDataMap.capture_method || "",
              captureMethods: attendanceDataMap.capture_method
                ? JSON.parse(
                    attendanceDataMap.capture_method.replace(/'/g, '"')
                  )
                : [],
              geoFencingEnabled: geoFencingEnabled,
              geoFenceRadius: geoFenceRadius,
              shiftType: attendanceDataMap.shift_type || "",
              shift_start_time: attendanceDataMap.shift_start_time
                ? attendanceDataMap.shift_start_time.replace("t", "T")
                : null,

              shift_end_time: attendanceDataMap.shift_end_time
                ? attendanceDataMap.shift_end_time.replace("t", "T")
                : null,

              flexibleHours: flexibleHours,
              grace_period_minutes: gracePeriodMinutes,
              halfDayHours: halfDayHours,
              fullDayHours: fullDayHours,
              breakDurationMinutes: breakDurationMinutes,
              workDaysPerWeek: workDaysPerWeek,
              overtimePolicyEnabled: overtimePolicyEnabled,
              minimumOvertimeMinutes: minimumOvertimeMinutes,
              overtime_calculation_type:
                attendanceDataMap.overtime_calculation_type || null,
              maxOvertimeHoursMonthly: maxOvertimeHoursMonthly,
              latePenaltyType: attendanceDataMap.late_penalty_type || "",
              late_penalty_leave_type:
                attendanceDataMap.late_penalty_leave_type || null,
              missing_swipe_policy:
                attendanceDataMap.missing_swipte_policy || "", // Note: there's a typo in the field name
              autoCheckoutEnabled: autoCheckoutEnabled,
              auto_checkout_time: attendanceDataMap.auto_checkout_time || null,
              regularizationAllowed: regularizationAllowed,
              regularization_window_days: regularizationWindowDays,
              regularization_limit_monthly: regularizationLimitMonthly,
              weekendOvertimeMultiplier: weekendOvertimeMultiplier,
              holidayOvertimeMultiplier: holidayOvertimeMultiplier,
              created_by: createdById,
              updated_by: updatedById,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Attendance Setting Object:",
              JSON.stringify(attendanceSettingObj, null, 2)
            );

            transformedData.push(attendanceSettingObj);
          }
        }
      }

      // Process shift_setting sheet if it exists
      if (data.shift_setting && data.shift_setting.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.shift_setting[1];

        // Track created shift configurations to avoid duplicates
        const createdShiftConfigurations = {};

        // Process each shift setting row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.shift_setting.length;
          rowIndex++
        ) {
          const shiftData = data.shift_setting[rowIndex];

          // Create a map of header to value for easier access
          const shiftDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              shiftDataMap[header] = shiftData[index];
            }
          });

          // Skip if required fields are missing
          if (!shiftDataMap.shift_name || !shiftDataMap.shift_type) continue;

          // Generate unique IDs
          const shiftId = generateDeterministicUUID(
            shiftDataMap.shift_name || "",
            shiftDataMap.shift_type || ""
          );

          const orgId = generateDeterministicUUID(
            shiftDataMap.auth_signatory_designation || "",
            shiftDataMap.cin || ""
          );

          const createdById = generateDeterministicUUID(
            shiftDataMap.created_by_emp_number || "",
            shiftDataMap.created_by_emp_first_name || ""
          );

          const updatedById = generateDeterministicUUID(
            shiftDataMap.updated_by_emp_number || "",
            shiftDataMap.updated_by_emp_first_name || ""
          );

          // Check if this shift configuration has been processed already
          if (!createdShiftConfigurations[shiftId]) {
            createdShiftConfigurations[shiftId] = true;

            // Convert numeric fields
            const flexibleHours = parseInt(shiftDataMap.flexible_hours) || 0;
            const breakDuration = parseInt(shiftDataMap.break_duration) || null;
            const gracePeriodMinutes =
              parseInt(shiftDataMap.grace_period_minutes) || null;
            const halfDayHours =
              parseFloat(shiftDataMap.half_day_hours) || null;
            const fullDayHours =
              parseFloat(shiftDataMap.full_day_hours) || null;

            // Create shift configuration object
            const shiftConfigurationObj = {
              shift_id: shiftId,
              org_id: orgId,
              shift_name: shiftDataMap.shift_name || "",
              shift_type: shiftDataMap.shift_type || "",
              start_time: shiftDataMap.start_time
                ? shiftDataMap.start_time.replace("t", "T")
                : null,
              end_time: shiftDataMap.end_time
                ? shiftDataMap.end_time.replace("t", "T")
                : null,
              flexible_hours: flexibleHours,
              break_duration: breakDuration,
              grace_period_minutes: gracePeriodMinutes,
              half_day_hours: halfDayHours,
              full_day_hours: fullDayHours,
              description: shiftDataMap.description || "",
              status: "active", // Default status as active
              created_by: createdById,
              updated_by: updatedById,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Shift Configuration Object:",
              JSON.stringify(shiftConfigurationObj, null, 2)
            );

            transformedData.push(shiftConfigurationObj);
          }
        }
      }

      // Process emp_shift_assignment sheet if it exists
      if (data.emp_shift_assignment && data.emp_shift_assignment.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.emp_shift_assignment[1];

        // Track created shift assignments to avoid duplicates
        const createdShiftAssignments = {};

        // Process each shift assignment row starting from index 2 (skipping header rows)
        for (
          let rowIndex = 2;
          rowIndex < data.emp_shift_assignment.length;
          rowIndex++
        ) {
          const assignmentData = data.emp_shift_assignment[rowIndex];

          // Create a map of header to value for easier access
          const assignmentDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              assignmentDataMap[header] = assignmentData[index];
            }
          });

          // Skip if required fields are missing
          if (
            !assignmentDataMap.employee_number ||
            !assignmentDataMap.shift_name ||
            !assignmentDataMap.effective_from
          )
            continue;

          // Generate unique IDs
          const assignmentId = generateDeterministicUUID(
            assignmentDataMap.shift_name || "",
            assignmentDataMap.effective_from || ""
          );

          const employeeId = generateDeterministicUUID(
            assignmentDataMap.employee_number || "",
            assignmentDataMap.employee_first_name || ""
          );

          const shiftId = generateDeterministicUUID(
            assignmentDataMap.shift_name || "",
            assignmentDataMap.shift_type || ""
          );

          const createdById = generateDeterministicUUID(
            assignmentDataMap.created_by_emp_number || "",
            assignmentDataMap.created_by_emp_first_name || ""
          );

          const updatedById = generateDeterministicUUID(
            assignmentDataMap.updated_by_emp_number || "",
            assignmentDataMap.updated_by_emp_first_name || ""
          );

          // Check if this shift assignment has been processed already
          if (!createdShiftAssignments[assignmentId]) {
            createdShiftAssignments[assignmentId] = true;

            // Create employee shift assignment object
            const employeeShiftAssignmentObj = {
              assignment_id: assignmentId,
              employee_id: employeeId,
              shift_id: shiftId,
              effective_from: assignmentDataMap.effective_from || null,
              effective_to: assignmentDataMap.effective_to || null,
              created_by: createdById,
              updated_by: updatedById,
              created_at: currentDateTime,
              updated_at: currentDateTime,
            };

            // Debug log to verify the object has all required fields
            console.log(
              "Employee Shift Assignment Object:",
              JSON.stringify(employeeShiftAssignmentObj, null, 2)
            );

            transformedData.push(employeeShiftAssignmentObj);
          }
        }
      }

      // Write transformed data to etltransform.json
      await this.writeFile(transformedData, "etltransform.json");

      logger.info({
        message: "Successfully transformed data and wrote to etltransform.json",
        metadata: {
          objectCount: transformedData.length,
          objectTypes: [
            ...new Set(
              transformedData.map((obj) => {
                // Get the first key that contains '_id'
                const idKey = Object.keys(obj).find((key) =>
                  key.includes("_id")
                );
                return idKey || "unknown";
              })
            ),
          ],
        },
      });

      return transformedData;
    } catch (error) {
      logger.error({
        message: "Error transforming data",
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
      });
      throw new AppError("Failed to transform data", 500);
    }
  }

  /**
   * Load the transformed data into the database
   * @param {Object} data - Transformed data from all sheets
   * @returns {Promise<Object>} - Loaded data
   */
  // async loadData(data) {
  //   try {
  //     // For now, we'll just log the data
  //     logger.info({
  //       message: "Ready to load data to database",
  //       metadata: {
  //         sheets: Object.keys(data),
  //         totalSheets: Object.keys(data).length,
  //       },
  //     });

  //     return data;
  //   } catch (error) {
  //     logger.error({
  //       message: "Error loading data",
  //       metadata: {
  //         error: {
  //           message: error.message,
  //           stack: error.stack,
  //         },
  //       },
  //     });
  //     throw new AppError("Failed to load data", 500);
  //   }
  // }

  // MODIFIED LOAD DATA FUNCTION
  /**
   * Load the transformed data into the database
   * @param {Object} data - Transformed data from all sheets
   * @returns {Promise<Object>} - Loaded data
   */
  async loadData() {
    try {
      // Read from etltransform.json using path module for consistent file resolution
      const path = require("path");
      const fs = require("fs").promises;
      const filePath = path.join(__dirname, "../../etltransform.json");
      const data = JSON.parse(await fs.readFile(filePath, "utf8"));

      logger.info({
        message: "Starting ETL load process",
        metadata: {
          objectCount: data.length,
          timestamp: new Date().toISOString(),
        },
      });

      // Track statistics
      const stats = {
        total: data.length,
        passed: 0,
        failed: 0,
        objectTypes: {},
      };

      // Process each object in the data array
      for (const obj of data) {
        // Determine object type for logging
        const objectType = validationService.determineObjectType(obj);

        // Initialize counter for this object type if needed
        if (!stats.objectTypes[objectType]) {
          stats.objectTypes[objectType] = { total: 0, passed: 0, failed: 0 };
        }
        stats.objectTypes[objectType].total++;

        // Validate the object
        const validation = validationService.validate(obj);

        if (validation.isValid) {
          // Object passed validation, send to passed_data queue
          await mqService.publishToPassed(obj);
          stats.passed++;
          stats.objectTypes[objectType].passed++;

          logger.debug({
            message: `Object passed validation: ${objectType}`,
            metadata: {
              objectType,
              id:
                obj.id ||
                obj.org_id ||
                obj.employee_id ||
                obj.shift_id ||
                obj.assignment_id,
            },
          });
        } else {
          // Object failed validation, send to failed_data queue
          await mqService.publishToFailed(obj, validation.errors);
          stats.failed++;
          stats.objectTypes[objectType].failed++;

          logger.warn({
            message: `Object failed validation: ${objectType}`,
            metadata: {
              objectType,
              id:
                obj.id ||
                obj.org_id ||
                obj.employee_id ||
                obj.shift_id ||
                obj.assignment_id,
              errors: validation.errors,
            },
          });
        }
      }

      logger.info({
        message: "ETL load process completed",
        metadata: {
          stats,
          timestamp: new Date().toISOString(),
        },
      });

      // Close the MQ connection
      await mqService.close();

      return stats;
    } catch (error) {
      logger.error({
        message: "Error loading data",
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
      });
      throw new AppError("Failed to load data", 500);
    }
  }
}

module.exports = new ETLService();
