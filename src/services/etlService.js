const xlsx = require("xlsx");
const { logger } = require("../utils/logger");
const AppError = require("../utils/appError");

class ETLService {
  constructor() {
    this.supportedSheets = [
      "organisation_details",
      "organisation_locations",
      "organization_departments",
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
      const workbook = xlsx.readFile(filePath);
      const parsedData = {};

      // Process all sheets in the workbook
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet, {
          raw: true,
          defval: null,
          header: 1 // Use 1-based array of values
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
      const fs = require('fs');
      fs.writeFileSync('etlextract.json', JSON.stringify(parsedData, null, 2));
      logger.info({
        message: 'Successfully wrote data to etlextract.json',
        metadata: {
          sheets: Object.keys(parsedData),
          totalSheets: Object.keys(parsedData).length,
        },
      });

      return processedData;
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
   * Transform the data according to business rules
   * @param {Object} data - Processed data from all sheets
   * @returns {Promise<Object>} - Transformed data
   */
  async transformData(data) {
    try {
      // For now, we'll just add metadata
      const transformedData = {
        ...data,
        metadata: {
          processedAt: new Date().toISOString(),
          version: "1.0",
        },
      };

      logger.info({
        message: "Successfully transformed data",
        metadata: {
          sheets: Object.keys(transformedData),
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
