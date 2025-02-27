const xlsx = require("xlsx");
const { logger } = require("../utils/logger");
const AppError = require("../utils/appError");
const { generateUUID, generateDeterministicUUID } = require("../utils/prismaIdGenerator");
const fs = require('fs');

class ETLService {
  constructor() {
    this.sheetsToProcess = [
      "organisation_details",
      "organisation_locations",
      "organization_departments",
      "Employees_data",
      "Emp_personal_details",
      "Emp_financial_details"
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
  async parseExcelFile(filePath) {
    try {
      // Configure date formatting
      const options = {
        cellDates: true, // Convert Excel dates to JS Date objects
        dateNF: 'MM/DD/YYYY' // Format dates as MM/DD/YYYY
      };
      
      const workbook = xlsx.readFile(filePath, options);
      const parsedData = {};

      // Process all sheets in the workbook
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet, {
          raw: false, // Don't keep raw values
          defval: null,
          header: 1, // Use 1-based array of values
          dateNF: 'MM/DD/YYYY' // Format dates as MM/DD/YYYY
        });

        logger.info({
          message: `Processing sheet: ${sheetName}`,
          metadata: {
            sheetName,
            rowCount: data.length
          },
        });

        parsedData[sheetName] = data;
      }

      // Write parsed data to etlextract.json
      await this.writeFile(parsedData, 'etlextract.json');
      logger.info({
        message: 'Successfully wrote data to etlextract.json',
        metadata: {
          sheets: Object.keys(parsedData),
          totalSheets: Object.keys(parsedData).length,
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
          },
        },
      });
      throw new AppError("Failed to parse Excel file", 500);
    }
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
      fs.writeFileSync(filePath, jsonString);

      logger.info({
        message: "Successfully wrote data to file",
        metadata: {
          filePath,
          size: Buffer.byteLength(jsonString),
          dataType: Array.isArray(data) ? 'Array' : typeof data
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
          const extractData = fs.readFileSync('etlextract.json', 'utf8');
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
        employeeFinancialDetails: {}
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
        const orgId = generateDeterministicUUID(orgDataMap.auth_signatory_designation, orgDataMap.cin);
        createdEntities.organizations[orgId] = true;
        
        const organizationObj = {
          org_id: orgId,
          legal_entity_name: orgDataMap.legal_entity_name || "",
          auth_signatory_name: orgDataMap.auth_signatory_name || "",
          auth_signatory_designation: orgDataMap.auth_signatory_designation ? orgDataMap.auth_signatory_designation.toLowerCase() : "",
          auth_signatory_email: orgDataMap.auth_signatory_email || "",
          auth_signatory_father_name: orgDataMap.auth_signatory_father_name || "",
          corporation_date: orgDataMap.corporation_date || null,
          cin: orgDataMap.cin || "",
          status: "active",
          created_at: currentDateTime,
          updated_at: currentDateTime
        };
        transformedData.push(organizationObj);

        // 2. Bank Master
        const bankId = generateDeterministicUUID(orgDataMap.bank_type, orgDataMap.bank_code);
        const bankMasterObj = {
          bank_id: bankId,
          bank_type: orgDataMap.bank_type || "",
          bank_name: orgDataMap.bank_name || "",
          bank_code: orgDataMap.bank_code || "",
          swift_code: orgDataMap.swift_code || "",
          is_active: true,
          created_at: currentDateTime,
          updated_at: currentDateTime
        };
        transformedData.push(bankMasterObj);

        // 3. Organization Bank Detail
        const orgBankId = generateDeterministicUUID(orgDataMap.account_number, orgDataMap.ifsc_code);
        const orgBankDetailObj = {
          org_bank_id: orgBankId,
          org_id: orgId,
          bank_id: bankId,
          account_number: orgDataMap.account_number || "",
          account_type: orgDataMap.account_type ? orgDataMap.account_type.toLowerCase() : "",
          ifsc_code: orgDataMap.ifsc_code || "",
          branch_name: orgDataMap.branch_name || "",
          name_on_account: orgDataMap.name_on_account || "",
          is_primary: true,
          status: "active",
          created_at: currentDateTime,
          updated_at: currentDateTime
        };
        transformedData.push(orgBankDetailObj);

        // 4. Organization Tax Detail
        const orgTaxId = generateDeterministicUUID(orgDataMap.pan, orgDataMap.tan);
        const orgTaxDetailObj = {
          org_tax_id: orgTaxId,
          org_id: orgId,
          pan: orgDataMap.pan || "",
          tan: orgDataMap.tan || "",
          tan_circle_number: orgDataMap.tan_circle_number || "",
          corporated_income_tax_location: orgDataMap.corporate_income_tax_locations || "",
          created_at: currentDateTime,
          updated_at: currentDateTime
        };
        transformedData.push(orgTaxDetailObj);

        // 5. Organization Compliance Detail
        const orgComplianceId = generateDeterministicUUID(orgDataMap.compliance_code, orgDataMap.pf_number);
        const orgComplianceDetailObj = {
          org_compliance_id: orgComplianceId,
          org_id: orgId,
          compliance_code: orgDataMap.compliance_code || "",
          pf_establishment_id: orgDataMap.pf_establishment_id || "",
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
          updated_at: currentDateTime
        };
        transformedData.push(orgComplianceDetailObj);
      }
      
      // Process organization_locations sheet if it exists
      if (data.organisation_locations && data.organisation_locations.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.organisation_locations[1];
        
        // Process rows starting from the third row (index 2)
        for (let rowIndex = 2; rowIndex < data.organisation_locations.length; rowIndex++) {
          const locationData = data.organisation_locations[rowIndex];
          
          // Create a map of header to value for easier access
          const locationDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              locationDataMap[header] = locationData[index];
            }
          });
          
          // 1. Country Master
          const countryId = generateDeterministicUUID(locationDataMap.country_code, locationDataMap.currency_code);
          
          // Only add country if it hasn't been added yet
          if (!createdEntities.countries[countryId]) {
            createdEntities.countries[countryId] = true;
            
            const countryMasterObj = {
              country_id: countryId,
              country_code: locationDataMap.country_code || "",
              country_name: locationDataMap.country_name || "",
              dial_code: locationDataMap.dial_code || "",
              currency_code: locationDataMap.currency_code || "",
              is_active: true,
              created_at: currentDateTime,
              updated_at: currentDateTime
            };
            transformedData.push(countryMasterObj);
          }
          
          // 2. State Master
          const stateId = generateDeterministicUUID(locationDataMap.state_code, locationDataMap.state_name);
          
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
              updated_at: currentDateTime
            };
            transformedData.push(stateMasterObj);
          }
          
          // 3. Organization Location
          const locationId = generateDeterministicUUID(locationDataMap.location_code, locationDataMap.city);
          
          // Get the organization ID using auth_signatory_designation and cin
          const orgId = generateDeterministicUUID(locationDataMap.auth_signatory_designation, locationDataMap.cin);
          
          const organizationLocationObj = {
            location_id: locationId,
            organization_id: orgId,
            location_name: locationDataMap.location_name || "",
            location_code: locationDataMap.location_code || "",
            is_head_office: locationDataMap.is_head_office?.toLowerCase() === "yes",
            is_registered_office: locationDataMap.is_registered_office?.toLowerCase() === "yes",
            is_branch: locationDataMap.is_branch?.toLowerCase() === "yes",
            address_line1: locationDataMap.address_line_1 || "",
            address_line2: locationDataMap.address_line_2 || "",
            locality: locationDataMap.locality || "",
            city: locationDataMap.city || "",
            country_id: countryId,
            state_id: stateId,
            pincode: locationDataMap.pincode || "",
            email: locationDataMap.email || "",
            phone: locationDataMap.phone || "",
            gstin: locationDataMap.gstin || "",
            timezone: locationDataMap.timezone || "",
            status: "active",
            created_at: currentDateTime,
            updated_at: currentDateTime
          };
          transformedData.push(organizationLocationObj);
        }
      }

      // Process organization_departments sheet if it exists
      if (data.organization_departments && data.organization_departments.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.organization_departments[1];
        
        // Keep track of department IDs by type_code and dept_code for parent department mapping
        const deptIdMap = {};
        
        // First pass: create all department types
        for (let rowIndex = 2; rowIndex < data.organization_departments.length; rowIndex++) {
          const deptData = data.organization_departments[rowIndex];
          
          // Create a map of header to value for easier access
          const deptDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              deptDataMap[header] = deptData[index];
            }
          });
          
          // 1. Department Type
          const deptTypeId = generateDeterministicUUID(deptDataMap.type_code, deptDataMap.type_name);
          
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
              updated_at: currentDateTime
            };
            transformedData.push(departmentTypeObj);
          }
          
          // Generate and store department ID for later reference
          const deptId = generateDeterministicUUID(deptDataMap.type_code, deptDataMap.dept_code);
          deptIdMap[`${deptDataMap.type_code}-${deptDataMap.dept_code}`] = deptId;
        }
        
        // Second pass: create all departments with proper parent references
        for (let rowIndex = 2; rowIndex < data.organization_departments.length; rowIndex++) {
          const deptData = data.organization_departments[rowIndex];
          
          // Create a map of header to value for easier access
          const deptDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              deptDataMap[header] = deptData[index];
            }
          });
          
          // Get organization ID using auth_signatory_designation and cin
          const orgId = generateDeterministicUUID(deptDataMap.auth_signatory_designation, deptDataMap.cin);
          
          // Get department type ID
          const deptTypeId = generateDeterministicUUID(deptDataMap.type_code, deptDataMap.type_name);
          
          // Get department ID
          const deptId = deptIdMap[`${deptDataMap.type_code}-${deptDataMap.dept_code}`];
          
          // Determine parent department ID if it exists
          let parentDeptId = null;
          if (deptDataMap.parent_dept_type_code && deptDataMap.parent_dept_code) {
            parentDeptId = deptIdMap[`${deptDataMap.parent_dept_type_code}-${deptDataMap.parent_dept_code}`];
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
              updated_at: currentDateTime
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
        for (let rowIndex = 2; rowIndex < data.Employees_data.length; rowIndex++) {
          const empData = data.Employees_data[rowIndex];
          
          // Create a map of header to value for easier access
          const empDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              empDataMap[header] = empData[index];
            }
          });
          
          // 1. Employment Type
          const employmentTypeId = generateDeterministicUUID(empDataMap.type_name, empDataMap.type_code);
          
          // Only add employment type if it hasn't been added yet
          if (!createdEntities.employmentTypes[employmentTypeId]) {
            createdEntities.employmentTypes[employmentTypeId] = true;
            
            const employmentTypeObj = {
              employment_type_id: employmentTypeId,
              type_name: empDataMap.type_name || "",
              type_code: empDataMap.type_code || "",
              description: empDataMap.description || "",
              created_at: currentDateTime,
              updated_at: currentDateTime
            };
            transformedData.push(employmentTypeObj);
          }
          
          // 2. Job Title
          const jobTitleId = generateDeterministicUUID(empDataMap.title_code, empDataMap.grade_level);
          const orgId = generateDeterministicUUID(empDataMap.auth_signatory_designation, empDataMap.cin);
          
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
              updated_at: currentDateTime
            };
            transformedData.push(jobTitleObj);
          }
        }
        
        // Second pass: Create all employees and handle reporting manager references
        // Store employee IDs by employee_number for reference
        const employeeIdsByNumber = {};
        
        // First create all employees
        for (let rowIndex = 2; rowIndex < data.Employees_data.length; rowIndex++) {
          const empData = data.Employees_data[rowIndex];
          
          // Create a map of header to value for easier access
          const empDataMap = {};
          headers.forEach((header, index) => {
            if (header) {
              empDataMap[header] = empData[index];
            }
          });
          
          // Generate employee ID
          const employeeId = generateDeterministicUUID(empDataMap.employee_number, empDataMap.first_name);
          employeeIdsByNumber[empDataMap.employee_number] = employeeId;
          
          // Get org ID
          const orgId = generateDeterministicUUID(empDataMap.auth_signatory_designation, empDataMap.cin);
          
          // Get employment type ID
          const employmentTypeId = generateDeterministicUUID(empDataMap.type_name, empDataMap.type_code);
          
          // Get department ID
          const deptId = generateDeterministicUUID(empDataMap.dept_type_code, empDataMap.dept_code);
          
          // Get work location ID (location_code, city)
          const workLocationId = generateDeterministicUUID(empDataMap.work_location_code, empDataMap.work_location_city);
          
          // Get job title ID
          const jobTitleId = generateDeterministicUUID(empDataMap.title_code, empDataMap.grade_level);
          
          // Only add employee if it hasn't been added yet
          if (!createdEntities.employees[employeeId]) {
            createdEntities.employees[employeeId] = true;
            
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
              mobile_number: empDataMap.mobile_number || "",
              emergency_contact_name: empDataMap.emergency_contact_name || "",
              emergency_contact_relationship: empDataMap.emergency_contact_relationship || "",
              emergency_contact_number: empDataMap.emergnecy_contact_number || "", // Note the typo in the header
              date_joined: empDataMap.date_joined || "",
              probation_end_date: empDataMap.probation_end_date || "",
              confirmation_date: empDataMap.confirmation_date || "",
              contract_end_date: empDataMap.contract_end_date || "",
              reporting_manager_emp_number: empDataMap.reporting_manager_employee_number || "",
              reporting_manager_first_name: empDataMap.reporting_manager_first_name || "",
              reporting_manager_id: null, // Will be populated in the next pass
              notice_period_days: parseInt(empDataMap.notice_period_days) || 0,
              status: "active",
              created_at: currentDateTime,
              updated_at: currentDateTime
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
          if (employee.reporting_manager_emp_number && employee.reporting_manager_first_name) {
            const managerId = employeeIdsByNumber[employee.reporting_manager_emp_number];
            if (managerId) {
              employee.reporting_manager_id = managerId;
            } else if (employee.reporting_manager_emp_number && employee.reporting_manager_first_name) {
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
        for (let rowIndex = 2; rowIndex < data.Emp_personal_details.length; rowIndex++) {
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
            if (personalDataMap.physically_challenged === "Yes") {
              physicallyChalleneged = true;
            } else if (personalDataMap.physically_challenged === "No") {
              physicallyChalleneged = false;
            }
            
            // Parse social media handles if available
            let socialMediaHandles = null;
            if (personalDataMap.social_media_handles) {
              try {
                // Try to parse as JSON if it's a valid JSON string
                socialMediaHandles = JSON.parse(personalDataMap.social_media_handles);
              } catch (e) {
                // If it's not valid JSON, just use the string
                socialMediaHandles = personalDataMap.social_media_handles;
              }
            }
            
            const employeePersonalDetailObj = {
              empl_personal_det_id: emplPersonalDetId,
              employee_id: employeeId,
              marital_status: personalDataMap.marital_status ? personalDataMap.marital_status.toLowerCase() : null,
              marriage_date: personalDataMap.marriage_date || null,
              blood_group: personalDataMap.blood_group || null,
              nationality: personalDataMap.nationality || null,
              physically_challenged: physicallyChalleneged,
              disability_details: personalDataMap.disability_details || null,
              father_name: personalDataMap.father_name || null,
              mother_name: personalDataMap.mother_name || null,
              spouse_name: personalDataMap.spouse_name || null,
              spouse_gender: personalDataMap.spouse_gender ? personalDataMap.spouse_gender.toLowerCase() : null,
              residence_number: personalDataMap.residence_number || null,
              social_media_handles: socialMediaHandles,
              created_at: currentDateTime,
              updated_at: currentDateTime
            };
            
            transformedData.push(employeePersonalDetailObj);
          }
        }
      }

      // Process Emp_financial_details sheet if it exists
      if (data.Emp_financial_details && data.Emp_financial_details.length >= 3) {
        // Headers are in the second row (index 1)
        const headers = data.Emp_financial_details[1];
        
        // Create a mapping of employee numbers to employee IDs
        const employeeIdsByNumber = {};
        for (const obj of transformedData) {
          if (obj.employee_id && obj.employee_number) {
            employeeIdsByNumber[obj.employee_number] = obj.employee_id;
          }
        }
        
        // Process each row of employee financial details
        for (let rowIndex = 2; rowIndex < data.Emp_financial_details.length; rowIndex++) {
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
          let employeeId = employeeIdsByNumber[financialDataMap.employee_number];
          if (!employeeId && financialDataMap.employee_first_name) {
            employeeId = generateDeterministicUUID(
              financialDataMap.employee_number,
              financialDataMap.employee_first_name
            );
          }
          
          // Skip if we can't link to an employee
          if (!employeeId) continue;
          
          // Generate Bank ID
          const bankId = generateDeterministicUUID(
            financialDataMap.bank_type || "",
            financialDataMap.bank_code || ""
          );
          
          // Add bank details if not already added
          if (financialDataMap.account_number && !createdEntities.banks[bankId]) {
            createdEntities.banks[bankId] = true;
            
            // Format account number properly (it may be in scientific notation)
            let formattedAccountNumber = financialDataMap.account_number;
            if (typeof formattedAccountNumber === 'number' || /\d+[eE][+-]?\d+/.test(formattedAccountNumber)) {
              // Convert from scientific notation to string
              formattedAccountNumber = String(Number(formattedAccountNumber));
            }
            
            // Generate employee bank detail ID
            const employeeBankId = generateDeterministicUUID(
              formattedAccountNumber,
              financialDataMap.employee_number
            );
            
            if (!createdEntities.employeeBankDetails[employeeBankId]) {
              createdEntities.employeeBankDetails[employeeBankId] = true;
              
              const employeeBankDetailObj = {
                employee_bank_id: employeeBankId,
                employee_id: employeeId,
                bank_id: bankId,
                account_number: formattedAccountNumber,
                account_type: financialDataMap.account_type || null,
                ifsc: financialDataMap.ifsc_code || null,
                branch_name: financialDataMap.branch_name || null,
                name_on_account: financialDataMap.name_on_account || null,
                is_primary: true, // Setting as primary by default
                status: true, // Setting as active by default
                created_at: currentDateTime,
                updated_at: currentDateTime
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
              
              if (!createdEntities.employeeFinancialDetails[emplFinancialId]) {
                createdEntities.employeeFinancialDetails[emplFinancialId] = true;
                
                // Convert boolean fields
                const pfDetailsAvailable = 
                  financialDataMap.pf_details_available === "Yes" ? true :
                  financialDataMap.pf_details_available === "No" ? false : null;
                
                const esiDetailsAvailable = 
                  financialDataMap.esi_details_available === "Yes" ? true :
                  financialDataMap.esi_details_available === "No" ? false : null;
                
                const esiEligible = 
                  financialDataMap.esi_eligible === "Yes" ? true :
                  financialDataMap.esi_eligible === "No" ? false : null;
                
                const lwfEligible = 
                  financialDataMap.lwf_eligible === "Yes" ? true :
                  financialDataMap.lwf_eligible === "No" ? false : null;
                
                const panAvailable = 
                  financialDataMap.pan_available === "Yes" ? true :
                  financialDataMap.pan_available === "No" ? false : null;
                
                const employeeFinancialDetailObj = {
                  empl_financial_id: emplFinancialId,
                  employee_id: employeeId,
                  compliance_id: complianceId,
                  employee_bank_id: employeeBankId,
                  salary_payment_mode: financialDataMap.salary_payment_mode || null,
                  pf_details_available: pfDetailsAvailable,
                  pf_number: financialDataMap.pf_number || null,
                  pf_joining_date: financialDataMap.pf_joining_date || null,
                  employee_contribution_to_pf: financialDataMap.employee_contribution_to_pf || null,
                  uan: financialDataMap.uan || null,
                  esi_details_available: esiDetailsAvailable,
                  esi_eligible: esiEligible,
                  employer_esi_number: financialDataMap.employer_esi_number || null,
                  lwf_eligible: lwfEligible,
                  aadhar_number: financialDataMap.aadhar_number || null,
                  dob_in_aadhar: financialDataMap.dob_in_aadhar || null,
                  full_name_in_aadhar: financialDataMap.full_name_in_aadhar || null,
                  gender_in_aadhar: financialDataMap.gender_in_aadhar ? financialDataMap.gender_in_aadhar.toLowerCase() : null,
                  pan_available: panAvailable,
                  pan_number: financialDataMap.pan_number || null,
                  full_name_in_pan: financialDataMap.full_name_in_pan || null,
                  dob_in_pan: financialDataMap.dob_in_pan || null,
                  parents_name_in_pan: financialDataMap.parent_name_in_pan || null,
                  created_at: currentDateTime,
                  updated_at: currentDateTime
                };
                
                transformedData.push(employeeFinancialDetailObj);
              }
            }
          }
        }
      }

      // Write transformed data to etltransform.json
      await this.writeFile(transformedData, 'etltransform.json');

      logger.info({
        message: "Successfully transformed data and wrote to etltransform.json",
        metadata: {
          objectCount: transformedData.length,
          objectTypes: [...new Set(transformedData.map(obj => {
            // Get the first key that contains '_id'
            const idKey = Object.keys(obj).find(key => key.includes('_id'));
            return idKey || 'unknown';
          }))]
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
  async loadData(data) {
    try {
      // For now, we'll just log the data
      logger.info({
        message: "Ready to load data to database",
        metadata: {
          sheets: Object.keys(data),
          totalSheets: Object.keys(data).length,
        },
      });

      return data;
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
