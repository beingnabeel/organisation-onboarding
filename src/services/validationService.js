const { logger } = require("../utils/logger");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class ValidationService {
  constructor() {
    this.prisma = prisma;
    this.validators = {
      Organization: (data) => {
        const errors = [];

        if (!data.org_id) errors.push("Missing org_id");
        if (!data.legal_entity_name) errors.push("Missing legal_entity_name");
        if (!data.auth_signatory_name)
          errors.push("Missing auth_signatory_name");
        if (!data.auth_signatory_designation)
          errors.push("Missing auth_signatory_designation");
        if (!data.auth_signatory_email) {
          errors.push("Missing auth_signatory_email");
        } else if (!ValidationService.isValidEmail(data.auth_signatory_email)) {
          errors.push(
            "Invalid auth_signatory_email format. Provide a valid email."
          );
        }

        if (!data.corporation_date) errors.push("Missing corporation_date");

        if (!data.cin) {
          errors.push("Missing CIN number.");
        } else if (!this.isValidCIN(data.cin)) {
          errors.push(
            "Invalid CIN format. It should start with 'L' or 'U' and be exactly 21 alphanumeric characters."
          );
        }

        return { isValid: errors.length === 0, errors };
      },
      BankMaster: (data) => {
        const errors = [];

        if (!data.bank_id) errors.push("Missing bank_id.");

        if (!data.bank_type) {
          errors.push("Missing bank_type.");
        } else if (
          !["organization_bank", "employee_bank"].includes(data.bank_type)
        ) {
          errors.push(
            "Invalid bank_type. Allowed values: organization_bank, employee_bank."
          );
        }

        if (!data.bank_name) errors.push("Missing bank_name.");
        if (data.bank_name && data.bank_name.length > 100)
          errors.push("bank_name should not exceed 100 characters.");

        if (!data.bank_code) {
          errors.push("Missing bank_code.");
        } else if (!/^\d{5}$/.test(data.bank_code)) {
          errors.push("Invalid bank_code. It should be a 5-digit unique code.");
        }

        if (data.swift_code) {
          if (data.swift_code.length < 8 || data.swift_code.length > 11) {
            errors.push(
              "Invalid swift_code. It should be between 8 and 11 characters."
            );
          }
        }

        if (typeof data.is_active !== "boolean") {
          errors.push("Invalid is_active value. It must be true or false.");
        }

        return { isValid: errors.length === 0, errors };
      },
      OrganizationBankDetail: (data) => {
        const errors = [];

        if (!data.org_bank_id) errors.push("Missing org_bank_id.");
        if (!data.org_id) errors.push("Missing org_id.");
        if (!data.bank_id) errors.push("Missing bank_id.");

        if (!data.account_number) {
          errors.push("Missing account_number.");
        } else if (
          data.account_number.length < 9 ||
          data.account_number.length > 18
        ) {
          errors.push(
            "Invalid account_number. It should be between 9 to 18 characters."
          );
        }

        if (!data.account_type) {
          errors.push("Missing account_type.");
        } else if (
          !["savings", "current", "salary"].includes(data.account_type)
        ) {
          errors.push(
            "Invalid account_type. Allowed values: savings, current, salary."
          );
        }

        if (!data.ifsc_code) {
          errors.push("Missing ifsc_code.");
        } else if (!/^[A-Za-z0-9]{11}$/.test(data.ifsc_code)) {
          errors.push(
            "Invalid ifsc_code. It should be an 11-character alphanumeric code."
          );
        }

        if (!data.branch_name) errors.push("Missing branch_name.");
        if (!data.name_on_account) errors.push("Missing name_on_account.");

        if (typeof data.is_primary !== "boolean") {
          errors.push("Invalid is_primary value. It must be true or false.");
        }

        return { isValid: errors.length === 0, errors };
      },
      OrganizationTaxDetail: (data) => {
        const errors = [];

        if (!data.org_tax_id) errors.push("Missing org_tax_id.");
        if (!data.org_id) errors.push("Missing org_id.");

        if (data.pan && !/^[A-Za-z0-9]{10}$/.test(data.pan)) {
          errors.push(
            "Invalid pan. It should be a 10-character alphanumeric code."
          );
        }

        if (data.tan && !/^[A-Za-z0-9]{10}$/.test(data.tan)) {
          errors.push(
            "Invalid tan. It should be a 10-character alphanumeric number."
          );
        }

        if (
          data.tan_circle_number &&
          !/^[A-Za-z0-9]{10}$/.test(data.tan_circle_number)
        ) {
          errors.push(
            "Invalid tan_circle_number. It should be a 10-character alphanumeric number."
          );
        }

        return { isValid: errors.length === 0, errors };
      },
      // OrganizationTax: (data) => {
      //   const errors = [];

      //   if (!data.org_tax_id) errors.push("Missing org_tax_id");
      //   if (!data.org_id) errors.push("Missing org_id");

      //   // Check for at least one tax identification
      //   if (!data.pan && !data.tan) {
      //     errors.push(
      //       "At least one tax identification (PAN or TAN) is required"
      //     );
      //   }

      //   // Validate PAN format if present
      //   if (data.pan && !this.isValidPAN(data.pan)) {
      //     errors.push(
      //       "Invalid PAN format. It should be a 10 character alphanumeric string."
      //     );
      //   }

      //   // Validate TAN format if present
      //   if (data.tan && !this.isValidTAN(data.tan)) {
      //     errors.push(
      //       "Invalid TAN format. It should be a 10 character alphanumeric string."
      //     );
      //   }

      //   return { isValid: errors.length === 0, errors };
      // },
      OrganizationComplianceDetail: (data) => {
        const errors = [];

        if (!data.org_compliance_id) errors.push("Missing org_compliance_id.");
        if (!data.org_id) errors.push("Missing org_id.");

        if (!data.compliance_code) {
          errors.push("Missing compliance_code.");
        } else if (!/^[A-Za-z0-9]{5,10}$/.test(data.compliance_code)) {
          errors.push(
            "Invalid compliance_code. It should be a 5 to 10 character unique alphanumeric code."
          );
        }

        if (
          data.pf_establishment_id &&
          !/^\d{7}$/.test(data.pf_establishment_id)
        ) {
          errors.push(
            "Invalid pf_establishment_id. It should be a 7-digit unique number."
          );
        }

        if (!data.pf_number) {
          errors.push("Missing pf_number.");
        } else if (!/^[A-Za-z0-9]{22}$/.test(data.pf_number)) {
          errors.push(
            "Invalid pf_number. It should be a 22-character alphanumeric code."
          );
        }

        if (data.esi_number && !/^\d{17}$/.test(data.esi_number)) {
          errors.push(
            "Invalid esi_number. It should be a 17-digit unique number."
          );
        }

        return { isValid: errors.length === 0, errors };
      },
      CountryMaster: (data) => {
        const errors = [];

        if (!data.country_id) errors.push("Missing country_id.");

        if (!data.country_code) {
          errors.push("Missing country_code.");
        } else if (!/^[a-zA-Z]{3}$/.test(data.country_code)) {
          errors.push(
            "Invalid country_code. It should be a 3-letter code (e.g., ind for India)."
          );
        }

        if (!data.country_name) {
          errors.push("Missing country_name.");
        } else if (data.country_name.length > 100) {
          errors.push("country_name should not exceed 100 characters.");
        }

        if (!data.dial_code) {
          errors.push("Missing dial_code.");
        } else if (!/^\d{1,4}$/.test(data.dial_code)) {
          errors.push(
            "Invalid dial_code. It should be a 1 to 4-digit number (e.g., 91 for India)."
          );
        }

        if (!data.currency_code) {
          errors.push("Missing currency_code.");
        } else if (!/^[a-zA-Z]{3}$/.test(data.currency_code)) {
          errors.push(
            "Invalid currency_code. It should be a 3-letter code (e.g., usd, inr)."
          );
        }

        if (typeof data.is_active !== "boolean") {
          errors.push("Invalid is_active value. It must be true or false.");
        }

        return { isValid: errors.length === 0, errors };
      },
      StateMaster: (data) => {
        const errors = [];

        if (!data.state_id) errors.push("Missing state_id.");

        if (!data.country_id) errors.push("Missing country_id.");

        if (!data.state_code) {
          errors.push("Missing state_code.");
        } else if (!/^[a-zA-Z]{3}$/.test(data.state_code)) {
          errors.push(
            "Invalid state_code. It should be any three letters from the state name (e.g., Bihar = bhr)."
          );
        }

        if (!data.state_name) {
          errors.push("Missing state_name.");
        } else if (data.state_name.length > 100) {
          errors.push("state_name should not exceed 100 characters.");
        }

        if (typeof data.is_active !== "boolean") {
          errors.push("Invalid is_active value. It must be true or false.");
        }

        return { isValid: errors.length === 0, errors };
      },
      OrganizationLocation: (data) => {
        const errors = [];

        if (!data.location_id) errors.push("Missing location_id.");
        if (!data.organizationId) errors.push("Missing organizationId.");

        if (!data.location_name) {
          errors.push("Missing location_name.");
        } else if (data.location_name.length > 100) {
          errors.push("location_name should not exceed 100 characters.");
        }

        if (!data.location_code) {
          errors.push("Missing location_code.");
        } else if (!/^[a-zA-Z0-9]{5}$/.test(data.location_code)) {
          errors.push(
            "Invalid location_code. It should be a 5-digit alphanumeric code."
          );
        }

        if (!data.address_line1) {
          errors.push("Missing address_line1.");
        } else if (data.address_line1.length > 255) {
          errors.push("address_line1 should not exceed 255 characters.");
        }

        if (data.address_line2 && data.address_line2.length > 255) {
          errors.push("address_line2 should not exceed 255 characters.");
        }

        if (data.locality && data.locality.length > 100) {
          errors.push("locality should not exceed 100 characters.");
        }

        if (!data.city) {
          errors.push("Missing city.");
        } else if (data.city.length > 100) {
          errors.push("city should not exceed 100 characters.");
        }

        if (!data.country_id) errors.push("Missing country_id.");
        if (!data.state_id) errors.push("Missing state_id.");

        if (!data.pincode) {
          errors.push("Missing pincode.");
        } else if (!/^\d{5,10}$/.test(data.pincode)) {
          errors.push(
            "Invalid pincode. It should be a number between 5 to 10 digits."
          );
        }

        if (data.email && !ValidationService.isValidEmail(data.email)) {
          errors.push("Invalid email format.");
        }

        if (data.phone && !/^\d{7,20}$/.test(data.phone)) {
          errors.push(
            "Invalid phone number. It should be between 7 to 20 digits."
          );
        }

        if (data.gstin && !/^[a-zA-Z0-9]{15}$/.test(data.gstin)) {
          errors.push(
            "Invalid GSTIN. It should be a 15-character alphanumeric code."
          );
        }

        if (!data.timezone) {
          errors.push("Missing timezone.");
        } else if (data.timezone.length > 50) {
          errors.push("timezone should not exceed 50 characters.");
        }

        return { isValid: errors.length === 0, errors };
      },
      DepartmentType: (data) => {
        const errors = [];

        if (!data.dept_type_id) errors.push("Missing dept_type_id.");

        if (!data.type_name) {
          errors.push("Missing type_name.");
        } else if (data.type_name.length > 50) {
          errors.push("type_name should not exceed 50 characters.");
        }

        if (!data.type_code) {
          errors.push("Missing type_code.");
        } else if (!/^[a-zA-Z0-9]{1,5}$/.test(data.type_code)) {
          errors.push(
            "Invalid type_code. It should be an alphanumeric code with a maximum of 5 characters."
          );
        }

        if (data.description && data.description.length > 1000) {
          errors.push("description should not exceed 1000 characters.");
        }

        if (typeof data.is_active !== "boolean") {
          errors.push("Invalid is_active value. It must be true or false.");
        }

        return { isValid: errors.length === 0, errors };
      },
      Department: (data) => {
        const errors = [];

        if (!data.dept_id) errors.push("Missing dept_id.");
        if (!data.org_id) errors.push("Missing org_id.");

        if (!data.dept_code) {
          errors.push("Missing dept_code.");
        } else if (!/^[a-zA-Z0-9]{1,20}$/.test(data.dept_code)) {
          errors.push(
            "Invalid dept_code. It should be an alphanumeric code with a maximum of 20 characters."
          );
        }

        if (!data.dept_name) {
          errors.push("Missing dept_name.");
        } else if (data.dept_name.length > 100) {
          errors.push("dept_name should not exceed 100 characters.");
        }

        if (
          data.cost_center_code &&
          !/^[a-zA-Z0-9]{1,5}$/.test(data.cost_center_code)
        ) {
          errors.push(
            "Invalid cost_center_code. It should be an alphanumeric code with a maximum of 5 characters."
          );
        }

        if (data.description && data.description.length > 1000) {
          errors.push("description should not exceed 1000 characters.");
        }

        if (typeof data.status !== "string") {
          errors.push("Invalid status value. It must be a string.");
        }

        return { isValid: errors.length === 0, errors };
      },
      EmploymentType: (data) => {
        const errors = [];

        if (!data.employment_type_id)
          errors.push("Missing employment_type_id.");

        if (!data.type_name) {
          errors.push("Missing type_name.");
        } else if (
          ![
            "permanent",
            "contract",
            "intern",
            "probation",
            "consultant",
          ].includes(data.type_name)
        ) {
          errors.push(
            "Invalid type_name. Allowed values: permanent, contract, internship, temporary, part_time."
          );
        }

        if (!data.type_code) {
          errors.push("Missing type_code.");
        } else if (!/^[a-zA-Z0-9]{1,50}$/.test(data.type_code)) {
          errors.push(
            "Invalid type_code. It should be an alphanumeric code with a maximum of 50 characters."
          );
        }

        if (data.description && data.description.length > 1000) {
          errors.push("description should not exceed 1000 characters.");
        }

        return { isValid: errors.length === 0, errors };
      },
      JobTitle: (data) => {
        const errors = [];

        if (!data.job_title_id) errors.push("Missing job_title_id.");
        if (!data.org_id) errors.push("Missing org_id.");

        if (!data.title_name) {
          errors.push("Missing title_name.");
        }

        if (!data.title_code) {
          errors.push("Missing title_code.");
        } else if (!/^[a-zA-Z0-9]{1,50}$/.test(data.title_code)) {
          errors.push(
            "Invalid title_code. It should be an alphanumeric code with a maximum of 50 characters."
          );
        }

        if (data.title_description && data.title_description.length > 1000) {
          errors.push("title_description should not exceed 1000 characters.");
        }

        if (
          data.grade_level !== undefined &&
          (!Number.isInteger(data.grade_level) || data.grade_level < 1)
        ) {
          errors.push("Invalid grade_level. It should be a positive integer.");
        }

        return { isValid: errors.length === 0, errors };
      },
      Employee: (data) => {
        const errors = [];

        if (!data.employee_id) errors.push("Missing employee_id.");

        if (!data.org_id) errors.push("Missing org_id.");

        if (!data.employee_number) {
          errors.push("Missing employee_number.");
        } else if (!/^[a-zA-Z0-9]{1,50}$/.test(data.employee_number)) {
          errors.push(
            "Invalid employee_number. It should be alphanumeric with a maximum of 50 characters."
          );
        }

        if (!data.first_name) {
          errors.push("Missing first_name.");
        } else if (data.first_name.length > 50) {
          errors.push("first_name should not exceed 50 characters.");
        }

        if (!data.last_name) {
          errors.push("Missing last_name.");
        } else if (data.last_name.length > 50) {
          errors.push("last_name should not exceed 50 characters.");
        }

        if (!data.display_name) {
          errors.push("Missing display_name.");
        } else if (data.display_name.length > 100) {
          errors.push("display_name should not exceed 100 characters.");
        }

        if (!data.date_of_birth) {
          errors.push("Missing date_of_birth.");
        } else if (new Date(data.date_of_birth) > new Date()) {
          errors.push("Invalid date_of_birth. It cannot be a future date.");
        }

        if (!["male", "female", "other"].includes(data.gender)) {
          errors.push("Invalid gender. Allowed values: male, female, other.");
        }

        if (
          data.official_email &&
          !ValidationService.isValidEmail(data.official_email)
        ) {
          errors.push("Invalid official_email format.");
        }

        if (
          data.personal_email &&
          !ValidationService.isValidEmail(data.personal_email)
        ) {
          errors.push("Invalid personal_email format.");
        }

        if (!data.mobile_number) {
          errors.push("Missing mobile_number.");
        } else if (!/^\d{10,15}$/.test(data.mobile_number)) {
          errors.push("Invalid mobile_number. It should contain 10-15 digits.");
        }

        if (
          data.emergency_contact_number &&
          !/^\d{10,15}$/.test(data.emergency_contact_number)
        ) {
          errors.push(
            "Invalid emergency_contact_number. It should contain 10-15 digits."
          );
        }

        if (!data.date_joined) {
          errors.push("Missing date_joined.");
        } else if (new Date(data.date_joined) > new Date()) {
          errors.push("Invalid date_joined. It cannot be a future date.");
        }

        if (
          data.probation_end_date &&
          new Date(data.probation_end_date) < new Date(data.date_joined)
        ) {
          errors.push(
            "Invalid probation_end_date. It cannot be before date_joined."
          );
        }

        if (
          data.confirmation_date &&
          new Date(data.confirmation_date) < new Date(data.date_joined)
        ) {
          errors.push(
            "Invalid confirmation_date. It cannot be before date_joined."
          );
        }

        if (
          data.contract_end_date &&
          new Date(data.contract_end_date) < new Date(data.date_joined)
        ) {
          errors.push(
            "Invalid contract_end_date. It cannot be before date_joined."
          );
        }

        if (data.notice_period_days < 0) {
          errors.push("Invalid notice_period_days. It cannot be negative.");
        }

        return { isValid: errors.length === 0, errors };
      },
      EmployeePersonalDetail: (data) => {
        const errors = [];

        if (!data.empl_personal_det_id)
          errors.push("Missing empl_personal_det_id.");

        if (!data.employee_id) errors.push("Missing employee_id.");

        const validMaritalStatuses = [
          "single",
          "married",
          "divorced",
          "widowed",
        ];
        if (
          data.marital_status &&
          !validMaritalStatuses.includes(data.marital_status)
        ) {
          errors.push(
            "Invalid marital_status. Allowed values: single, married, divorced, widowed."
          );
        }

        if (data.marital_status === "married" && !data.marriage_date) {
          errors.push("marriage_date is required for married employees.");
        }

        // if (data.marriage_date && new Date(data.marriage_date) > new Date()) {
        //   errors.push("Invalid marriage_date. It cannot be a future date.");
        // }

        // ✅ Blood group validation (case-insensitive)
        if (data.blood_group) {
          const normalizedBloodGroup = data.blood_group.toUpperCase();
          if (!/^(A|B|AB|O)[+-]$/.test(normalizedBloodGroup)) {
            errors.push(
              "Invalid blood_group. Allowed values: A+, A-, B+, B-, AB+, AB-, O+, O-."
            );
          }
        }

        // if (!data.nationality) {
        //   errors.push("Missing nationality.");
        // } else if (data.nationality.length > 50) {
        //   errors.push("nationality should not exceed 50 characters.");
        // }

        if (typeof data.physically_challenged !== "boolean") {
          errors.push(
            "Invalid physically_challenged. It must be true or false."
          );
        }

        if (data.physically_challenged && !data.disability_details) {
          errors.push(
            "disability_details is required if physically_challenged is true."
          );
        }

        if (!data.father_name) {
          errors.push("Missing father_name.");
        } else if (data.father_name.length > 100) {
          errors.push("father_name should not exceed 100 characters.");
        }

        if (!data.mother_name) {
          errors.push("Missing mother_name.");
        } else if (data.mother_name.length > 100) {
          errors.push("mother_name should not exceed 100 characters.");
        }

        if (data.spouse_name && data.spouse_name.length > 100) {
          errors.push("spouse_name should not exceed 100 characters.");
        }

        const validGenders = ["male", "female", "other"];
        if (data.spouse_gender && !validGenders.includes(data.spouse_gender)) {
          errors.push(
            "Invalid spouse_gender. Allowed values: male, female, other."
          );
        }

        // ✅ Residence number validation (accepts anything larger than 3 digits)
        if (
          data.residence_number &&
          !/^\d{4,}$/.test(String(data.residence_number))
        ) {
          errors.push(
            "Invalid residence_number. It should contain at least 4 digits."
          );
        }

        return { isValid: errors.length === 0, errors };
      },
      EmployeeBankDetail: (data) => {
        const errors = [];

        if (!data.employee_bank_id) errors.push("Missing employee_bank_id.");
        if (!data.employee_id) errors.push("Missing employee_id.");
        if (!data.bank_id) errors.push("Missing bank_id.");

        if (!data.account_number) {
          errors.push("Missing account_number.");
        } else if (!/^\d{9,18}$/.test(data.account_number)) {
          errors.push("Invalid account_number. It should contain 9-18 digits.");
        }

        const validAccountTypes = ["salary", "savings", "current"];
        if (
          data.account_type &&
          !validAccountTypes.includes(data.account_type)
        ) {
          errors.push(
            "Invalid account_type. Allowed values: salary, savings, current, fixed, recurring."
          );
        }

        if (!data.ifsc_code) {
          errors.push("Missing ifsc_code.");
        } else {
          // Convert IFSC code to uppercase before validation
          const ifscCode = data.ifsc_code.toUpperCase();
          if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
            errors.push(
              "Invalid ifsc_code. It must be a valid 11-character IFSC code."
            );
          }
        }

        if (!data.branch_name) {
          errors.push("Missing branch_name.");
        } else if (data.branch_name.length > 100) {
          errors.push("branch_name should not exceed 100 characters.");
        }

        if (!data.name_on_account) {
          errors.push("Missing name_on_account.");
        } else if (data.name_on_account.length > 100) {
          errors.push("name_on_account should not exceed 100 characters.");
        }

        if (typeof data.is_primary !== "boolean") {
          errors.push("Invalid is_primary. It must be true or false.");
        }

        if (!data.status) {
          errors.push("Missing status.");
        } else if (typeof data.status !== "string" || data.status.length > 50) {
          errors.push(
            "Invalid status. It must be a string and not exceed 50 characters."
          );
        }

        return { isValid: errors.length === 0, errors };
      },
      EmployeeFinancialDetail: (data) => {
        const errors = [];

        if (!data.empl_financial_id) errors.push("Missing empl_financial_id.");
        if (!data.employee_id) errors.push("Missing employee_id.");

        const validPaymentModes = ["bank_transfer", "cash", "cheque", "other"];
        if (
          data.salary_payment_mode &&
          !validPaymentModes.includes(data.salary_payment_mode)
        ) {
          errors.push(
            "Invalid salary_payment_mode. Allowed values: bank_transfer, cash, cheque, other."
          );
        }

        // if (data.pf_number && !/^\d{22}$/.test(data.pf_number)) {
        //   errors.push(
        //     "Invalid pf_number. It should contain exactly 22 digits."
        //   );
        // }

        if (data.uan && !/^\d{12}$/.test(data.uan)) {
          errors.push("Invalid UAN. It should contain exactly 12 digits.");
        }

        if (
          data.employer_esi_number &&
          !/^\d{17}$/.test(data.employer_esi_number)
        ) {
          errors.push(
            "Invalid employer_esi_number. It should contain exactly 17 digits."
          );
        }

        if (data.aadhar_number && !/^\d{12}$/.test(data.aadhar_number)) {
          errors.push(
            "Invalid aadhar_number. It should contain exactly 12 digits."
          );
        }

        // if (data.pan_number) {
        //   const panUpperCase = data.pan_number.toUpperCase(); // Convert to uppercase for case-insensitive validation
        //   if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panUpperCase)) {
        //     errors.push(
        //       "Invalid PAN number. It should follow the format: ABCDE1234F."
        //     );
        //   }
        // }

        if (!data.full_name_in_aadhar) {
          errors.push("Missing full_name_in_aadhar.");
        } else if (data.full_name_in_aadhar.length > 100) {
          errors.push("full_name_in_aadhar should not exceed 100 characters.");
        }

        if (
          data.gender_in_aadhar &&
          !["male", "female", "other"].includes(
            data.gender_in_aadhar.toLowerCase()
          )
        ) {
          errors.push(
            "Invalid gender_in_aadhar. Allowed values: male, female, other."
          );
        }

        if (!data.full_name_in_pan) {
          errors.push("Missing full_name_in_pan.");
        } else if (data.full_name_in_pan.length > 100) {
          errors.push("full_name_in_pan should not exceed 100 characters.");
        }

        if (data.parents_name_in_pan && data.parents_name_in_pan.length > 100) {
          errors.push("parents_name_in_pan should not exceed 100 characters.");
        }

        return { isValid: errors.length === 0, errors };
      },
      SalaryComponentMaster: (data) => {
        const errors = [];

        if (!data.component_id) errors.push("Missing component_id.");
        if (!data.org_id) errors.push("Missing org_id.");
        if (!data.component_name || data.component_name.length > 100) {
          errors.push(
            "component_name is required and should not exceed 100 characters."
          );
        }
        if (!data.component_code || data.component_code.length > 20) {
          errors.push(
            "component_code is required and should not exceed 20 characters."
          );
        }

        const validCategories = [
          "earnings",
          "deductions",
          "benefits",
          "reimbursements",
        ];
        if (!validCategories.includes(data.component_category)) {
          errors.push(
            `Invalid component_category. Allowed values: ${validCategories.join(", ")}.`
          );
        }

        const validTypes = ["fixed", "variable", "adhoc"];
        if (!validTypes.includes(data.component_type)) {
          errors.push(
            `Invalid component_type. Allowed values: ${validTypes.join(", ")}.`
          );
        }

        const validCalculationTypes = [
          "fixed",
          "percentage",
          "formula",
          "hourly",
          "daily",
          "per_unit",
        ];
        if (!validCalculationTypes.includes(data.calculation_type)) {
          errors.push(
            `Invalid calculation_type. Allowed values: ${validCalculationTypes.join(", ")}.`
          );
        }

        const validFrequencies = ["monthly", "quarterly", "annual", "one_time"];
        if (
          data.calculation_frequency &&
          !validFrequencies.includes(data.calculation_frequency)
        ) {
          errors.push(
            `Invalid calculation_frequency. Allowed values: ${validFrequencies.join(", ")}.`
          );
        }

        if (data.min_value && isNaN(parseFloat(data.min_value))) {
          errors.push("Invalid min_value. It should be a decimal number.");
        }

        if (data.max_value && isNaN(parseFloat(data.max_value))) {
          errors.push("Invalid max_value. It should be a decimal number.");
        }

        if (
          data.min_value &&
          data.max_value &&
          parseFloat(data.min_value) > parseFloat(data.max_value)
        ) {
          errors.push("min_value cannot be greater than max_value.");
        }

        if (
          data.rounding_factor !== undefined &&
          (!Number.isInteger(data.rounding_factor) || data.rounding_factor < 0)
        ) {
          errors.push("rounding_factor should be a non-negative integer.");
        }

        if (data.print_name && data.print_name.length > 100) {
          errors.push("print_name should not exceed 100 characters.");
        }

        return { isValid: errors.length === 0, errors };
      },
      SalaryStructure: (data) => {
        const errors = [];

        if (!data.structure_id) errors.push("Missing structure_id.");
        if (!data.org_id) errors.push("Missing org_id.");

        if (!data.structure_name || data.structure_name.length > 100) {
          errors.push(
            "structure_name is required and should not exceed 100 characters."
          );
        }

        if (!data.structure_code || data.structure_code.length > 20) {
          errors.push(
            "structure_code is required and should not exceed 20 characters."
          );
        }

        if (data.min_ctc && isNaN(parseFloat(data.min_ctc))) {
          errors.push("Invalid min_ctc. It should be a decimal number.");
        }

        if (data.max_ctc && isNaN(parseFloat(data.max_ctc))) {
          errors.push("Invalid max_ctc. It should be a decimal number.");
        }

        if (
          data.min_ctc &&
          data.max_ctc &&
          parseFloat(data.min_ctc) > parseFloat(data.max_ctc)
        ) {
          errors.push("min_ctc cannot be greater than max_ctc.");
        }

        if (!data.effective_from) {
          errors.push("effective_from date is required.");
        } else if (isNaN(Date.parse(data.effective_from))) {
          errors.push("Invalid effective_from date.");
        }

        if (data.effective_to && isNaN(Date.parse(data.effective_to))) {
          errors.push("Invalid effective_to date.");
        }

        if (
          data.effective_from &&
          data.effective_to &&
          new Date(data.effective_from) > new Date(data.effective_to)
        ) {
          errors.push("effective_from date cannot be after effective_to date.");
        }

        return { isValid: errors.length === 0, errors };
      },
      SalaryStructureComponent: (data) => {
        const errors = [];

        if (!data.structure_component_id)
          errors.push("Missing structure_component_id.");
        if (!data.structure_id) errors.push("Missing structure_id.");
        if (!data.component_id) errors.push("Missing component_id.");

        if (
          data.calculation_priority !== undefined &&
          !Number.isInteger(data.calculation_priority)
        ) {
          errors.push("calculation_priority must be an integer.");
        }

        // if (
        //   data.percentage_of_basic !== undefined &&
        //   (isNaN(parseFloat(data.percentage_of_basic)) ||
        //     data.percentage_of_basic < 0)
        // ) {
        //   errors.push(
        //     "percentage_of_basic must be a valid decimal greater than or equal to 0."
        //   );
        // }

        // if (
        //   data.percentage_of_ctc !== undefined &&
        //   (isNaN(parseFloat(data.percentage_of_ctc)) ||
        //     data.percentage_of_ctc < 0)
        // ) {
        //   errors.push(
        //     "percentage_of_ctc must be a valid decimal greater than or equal to 0."
        //   );
        // }

        // if (data.min_value !== undefined && isNaN(parseFloat(data.min_value))) {
        //   errors.push("min_value must be a valid decimal number.");
        // }

        // if (data.max_value !== undefined && isNaN(parseFloat(data.max_value))) {
        //   errors.push("max_value must be a valid decimal number.");
        // }
        const isValidNumber = (value) =>
          value !== undefined && value !== null && !isNaN(parseFloat(value));

        // // Validate percentage_of_basic only if it is neither undefined nor null
        // if (
        //   isValidNumber(data.percentage_of_basic) &&
        //   data.percentage_of_basic < 0
        // ) {
        //   errors.push(
        //     "percentage_of_basic must be a valid decimal greater than or equal to 0."
        //   );
        // }

        // // Validate percentage_of_ctc only if it is neither undefined nor null
        // if (
        //   isValidNumber(data.percentage_of_ctc) &&
        //   data.percentage_of_ctc < 0
        // ) {
        //   errors.push(
        //     "percentage_of_ctc must be a valid decimal greater than or equal to 0."
        //   );
        // }

        // // Validate min_value only if it is neither undefined nor null
        // if (isValidNumber(data.min_value) === false) {
        //   errors.push("min_value must be a valid decimal number.");
        // }

        // // Validate max_value only if it is neither undefined nor null
        // if (isValidNumber(data.max_value) === false) {
        //   errors.push("max_value must be a valid decimal number.");
        // }

        // if (
        //   data.min_value !== undefined &&
        //   data.max_value !== undefined &&
        //   parseFloat(data.min_value) > parseFloat(data.max_value)
        // ) {
        //   errors.push("min_value cannot be greater than max_value.");
        // }

        // if (
        //   data.default_value !== undefined &&
        //   isNaN(parseFloat(data.default_value))
        // ) {
        //   errors.push("default_value must be a valid decimal number.");
        // }

        if (typeof data.is_mandatory !== "boolean") {
          errors.push("is_mandatory must be a boolean value (true/false).");
        }

        return { isValid: errors.length === 0, errors };
      },
      EmployeeSalary: (data) => {
        const errors = [];

        if (!data.salary_id) errors.push("Missing salary_id.");
        if (!data.employee_id) errors.push("Missing employee_id.");
        if (!data.structure_id) errors.push("Missing structure_id.");
        if (!data.effective_from) errors.push("Missing effective_from date.");
        if (
          !data.annual_ctc ||
          isNaN(parseFloat(data.annual_ctc)) ||
          data.annual_ctc <= 0
        ) {
          errors.push("annual_ctc must be a valid positive decimal.");
        }
        if (
          !data.monthly_ctc ||
          isNaN(parseFloat(data.monthly_ctc)) ||
          data.monthly_ctc <= 0
        ) {
          errors.push("monthly_ctc must be a valid positive decimal.");
        }
        if (
          !data.basic_percent ||
          isNaN(parseFloat(data.basic_percent)) ||
          data.basic_percent < 0
        ) {
          errors.push(
            "basic_percent must be a valid decimal greater than or equal to 0."
          );
        }
        if (
          data.hra_percent !== undefined &&
          (isNaN(parseFloat(data.hra_percent)) || data.hra_percent < 0)
        ) {
          errors.push(
            "hra_percent must be a valid decimal greater than or equal to 0."
          );
        }

        if (
          data.effective_to &&
          new Date(data.effective_from) > new Date(data.effective_to)
        ) {
          errors.push(
            "effective_from date cannot be later than effective_to date."
          );
        }

        if (data.revision_type && typeof data.revision_type !== "string") {
          errors.push("revision_type must be a valid string.");
        }

        if (data.revision_reason && typeof data.revision_reason !== "string") {
          errors.push("revision_reason must be a valid string.");
        }

        return { isValid: errors.length === 0, errors };
      },
      PayrollCycle: (data) => {
        const errors = [];

        if (!data.cycle_id) errors.push("Missing cycle_id.");
        if (!data.org_id) errors.push("Missing org_id.");
        if (!data.cycle_name || typeof data.cycle_name !== "string") {
          errors.push("cycle_name must be a valid string.");
        }

        if (
          data.start_day === undefined ||
          !Number.isInteger(data.start_day) ||
          data.start_day < 1 ||
          data.start_day > 31
        ) {
          errors.push("start_day must be an integer between 1 and 31.");
        }

        if (
          data.end_day === undefined ||
          !Number.isInteger(data.end_day) ||
          data.end_day < 1 ||
          data.end_day > 31
        ) {
          errors.push("end_day must be an integer between 1 and 31.");
        }

        if (data.start_day > data.end_day) {
          errors.push("start_day cannot be greater than end_day.");
        }

        if (
          data.processing_day === undefined ||
          !Number.isInteger(data.processing_day) ||
          data.processing_day < 1 ||
          data.processing_day > 31
        ) {
          errors.push("processing_day must be an integer between 1 and 31.");
        }

        if (
          data.payment_day === undefined ||
          !Number.isInteger(data.payment_day) ||
          data.payment_day < 1 ||
          data.payment_day > 31
        ) {
          errors.push("payment_day must be an integer between 1 and 31.");
        }

        if (typeof data.consider_previous_month !== "boolean") {
          errors.push("consider_previous_month must be a boolean value.");
        }

        if (typeof data.is_default !== "boolean") {
          errors.push("is_default must be a boolean value.");
        }

        return { isValid: errors.length === 0, errors };
      },
      PayrollRun: (data) => {
        const errors = [];

        if (!data.run_id) errors.push("Missing run_id.");
        if (!data.org_id) errors.push("Missing org_id.");
        if (!data.cycle_id) errors.push("Missing cycle_id.");

        if (!data.run_date || isNaN(new Date(data.run_date))) {
          errors.push("run_date must be a valid date.");
        }

        if (!data.start_date || isNaN(new Date(data.start_date))) {
          errors.push("start_date must be a valid date.");
        }

        if (!data.end_date || isNaN(new Date(data.end_date))) {
          errors.push("end_date must be a valid date.");
        }

        if (new Date(data.start_date) > new Date(data.end_date)) {
          errors.push("start_date cannot be greater than end_date.");
        }

        if (
          !Number.isInteger(data.total_employees) ||
          data.total_employees < 0
        ) {
          errors.push("total_employees must be a non-negative integer.");
        }

        if (isNaN(parseFloat(data.total_gross)) || data.total_gross < 0) {
          errors.push("total_gross must be a non-negative decimal.");
        }

        if (
          isNaN(parseFloat(data.total_deductions)) ||
          data.total_deductions < 0
        ) {
          errors.push("total_deductions must be a non-negative decimal.");
        }

        if (isNaN(parseFloat(data.total_net_pay)) || data.total_net_pay < 0) {
          errors.push("total_net_pay must be a non-negative decimal.");
        }

        // if (data.total_net_pay !== data.total_gross - data.total_deductions) {
        //   errors.push(
        //     "total_net_pay must be equal to total_gross minus total_deductions."
        //   );
        // }

        const validStatuses = [
          "draft",
          "processing",
          "review_pending",
          "approved",
          "rejected",
          "completed",
          "cancelled",
        ];
        if (!validStatuses.includes(data.status)) {
          errors.push(`status must be one of ${validStatuses.join(", ")}.`);
        }

        if (typeof data.locked !== "boolean") {
          errors.push("locked must be a boolean value.");
        }

        if (data.processed_by && typeof data.processed_by !== "string") {
          errors.push("processed_by must be a valid UUID string.");
        }

        if (data.approved_by && typeof data.approved_by !== "string") {
          errors.push("approved_by must be a valid UUID string.");
        }

        return { isValid: errors.length === 0, errors };
      },
      PolicyModule: (data) => {
        const errors = [];

        if (!data.module_id) errors.push("Missing module_id.");
        if (!data.org_id) errors.push("Missing org_id.");
        if (!data.module_name || data.module_name.trim().length === 0) {
          errors.push("module_name is required.");
        }
        if (!data.module_code || data.module_code.trim().length === 0) {
          errors.push("module_code is required.");
        }

        // Validate module_category
        const validModuleCategories = [
          "employment",
          "leave",
          "attendance",
          "payroll",
          "benefits",
          "compliance",
          "performance",
          "training",
          "it_security",
          "general",
        ]; // Adjust based on your enum values
        if (!validModuleCategories.includes(data.module_category)) {
          errors.push(
            `module_category must be one of ${validModuleCategories.join(", ")}.`
          );
        }

        // Validate version format (Semantic Versioning)
        const versionRegex = /^\d+\.\d+\.\d+$/;
        if (!versionRegex.test(data.version)) {
          errors.push("version must be in semantic format (e.g., 1.0.0).");
        }

        // Validate is_mandatory (Boolean)
        if (typeof data.is_mandatory !== "boolean") {
          errors.push("is_mandatory must be a boolean.");
        }

        // Validate status
        const validStatuses = ["draft", "active", "archived"];
        if (!validStatuses.includes(data.status)) {
          errors.push(`status must be one of ${validStatuses.join(", ")}.`);
        }

        // Validate dates
        if (!data.effective_from || isNaN(new Date(data.effective_from))) {
          errors.push("effective_from must be a valid date.");
        }

        if (data.effective_to && isNaN(new Date(data.effective_to))) {
          errors.push("effective_to must be a valid date.");
        }

        if (
          data.effective_to &&
          new Date(data.effective_from) > new Date(data.effective_to)
        ) {
          errors.push("effective_from cannot be greater than effective_to.");
        }

        // Validate UUIDs for created_by and updated_by if present
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

        if (data.created_by && !uuidRegex.test(data.created_by)) {
          errors.push("created_by must be a valid UUID.");
        }

        if (data.updated_by && !uuidRegex.test(data.updated_by)) {
          errors.push("updated_by must be a valid UUID.");
        }

        return { isValid: errors.length === 0, errors };
      },
      PolicySetting: (data) => {
        const errors = [];

        if (!data.setting_id) errors.push("Missing setting_id.");
        if (!data.module_id) errors.push("Missing module_id.");
        if (!data.org_id) errors.push("Missing org_id.");

        if (!data.setting_name || data.setting_name.trim().length === 0) {
          errors.push("setting_name is required.");
        }

        if (!data.setting_key || data.setting_key.trim().length === 0) {
          errors.push("setting_key is required.");
        }

        if (!data.setting_value) {
          errors.push("setting_value is required.");
        } else {
          try {
            JSON.stringify(data.setting_value); // Ensure it's a valid JSON value
          } catch {
            errors.push("setting_value must be valid JSON.");
          }
        }

        // Validate setting_type
        const validSettingTypes = ["number", "string", "boolean", "json"];
        if (!validSettingTypes.includes(data.setting_type)) {
          errors.push(
            `setting_type must be one of ${validSettingTypes.join(", ")}.`
          );
        }

        // Validate is_encrypted and is_configurable (Boolean)
        if (typeof data.is_encrypted !== "boolean") {
          errors.push("is_encrypted must be a boolean.");
        }

        if (typeof data.is_configurable !== "boolean") {
          errors.push("is_configurable must be a boolean.");
        }

        // Validate validation_rules and default_value if provided
        if (data.validation_rules) {
          try {
            JSON.stringify(data.validation_rules);
          } catch {
            errors.push("validation_rules must be valid JSON.");
          }
        }

        if (data.default_value) {
          try {
            JSON.stringify(data.default_value);
          } catch {
            errors.push("default_value must be valid JSON.");
          }
        }

        // Validate status
        const validStatuses = ["active", "inactive"];
        if (!validStatuses.includes(data.status)) {
          errors.push(`status must be one of ${validStatuses.join(", ")}.`);
        }

        // Validate UUIDs for created_by and updated_by if present
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

        if (data.created_by && !uuidRegex.test(data.created_by)) {
          errors.push("created_by must be a valid UUID.");
        }

        if (data.updated_by && !uuidRegex.test(data.updated_by)) {
          errors.push("updated_by must be a valid UUID.");
        }

        return { isValid: errors.length === 0, errors };
      },
      ProbationPolicy: (data) => {
        const errors = [];

        if (!data.policy_id) errors.push("Missing policy_id.");
        if (!data.org_id) errors.push("Missing org_id.");

        // probation_code is required and must be a string
        if (!data.probation_code || data.probation_code.trim().length === 0) {
          errors.push("probation_code is required.");
        } else if (data.probation_code.length > 50) {
          errors.push("probation_code must not exceed 50 characters.");
        }

        // probation_period_months must be a positive integer
        if (
          !Number.isInteger(data.probation_period_months) ||
          data.probation_period_months <= 0
        ) {
          errors.push("probation_period_months must be a positive integer.");
        }

        // min_extension_months must be a positive integer
        if (
          !Number.isInteger(data.min_extension_months) ||
          data.min_extension_months < 1
        ) {
          errors.push("min_extension_months must be at least 1.");
        }

        // max_extension_months must be a positive integer if provided
        if (
          data.max_extension_months !== null &&
          data.max_extension_months !== undefined
        ) {
          if (
            !Number.isInteger(data.max_extension_months) ||
            data.max_extension_months < 0
          ) {
            errors.push("max_extension_months must be a positive integer.");
          }
        }

        // extension_allowed should be a boolean
        if (typeof data.extension_allowed !== "boolean") {
          errors.push("extension_allowed must be a boolean.");
        }

        // max_extensions must be a non-negative integer
        if (!Number.isInteger(data.max_extensions) || data.max_extensions < 0) {
          errors.push("max_extensions must be a non-negative integer.");
        }

        // auto_confirm should be a boolean
        if (typeof data.auto_confirm !== "boolean") {
          errors.push("auto_confirm must be a boolean.");
        }

        // notice_period_days must be a positive integer
        if (
          !Number.isInteger(data.notice_period_days) ||
          data.notice_period_days <= 0
        ) {
          errors.push("notice_period_days must be a positive integer.");
        }

        // review_required should be a boolean
        if (typeof data.review_required !== "boolean") {
          errors.push("review_required must be a boolean.");
        }

        // review_before_days must be a non-negative integer
        if (
          !Number.isInteger(data.review_before_days) ||
          data.review_before_days < 0
        ) {
          errors.push("review_before_days must be a non-negative integer.");
        }

        // Validate status
        const validStatuses = ["active", "inactive"];
        if (!validStatuses.includes(data.status)) {
          errors.push(`status must be one of ${validStatuses.join(", ")}.`);
        }

        // Validate UUIDs for optional fields
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

        const uuidFields = [
          "employment_type_id",
          "employee_id",
          "dept_id",
          "created_by",
          "updated_by",
        ];
        uuidFields.forEach((field) => {
          if (data[field] && !uuidRegex.test(data[field])) {
            errors.push(`${field} must be a valid UUID.`);
          }
        });

        return { isValid: errors.length === 0, errors };
      },
      PolicyDocumentVersion: (data) => {
        const errors = [];

        if (!data.version_id) errors.push("Missing version_id.");
        if (!data.module_id) errors.push("Missing module_id.");

        // version_number is required and must not exceed 20 characters
        if (!data.version_number || data.version_number.trim().length === 0) {
          errors.push("version_number is required.");
        } else if (data.version_number.length > 20) {
          errors.push("version_number must not exceed 20 characters.");
        }

        // document_url should be a valid URL if provided
        if (data.document_url) {
          try {
            new URL(data.document_url);
          } catch {
            errors.push("document_url must be a valid URL.");
          }
        }

        // effective_from is required and must be a valid date
        if (
          !data.effective_from ||
          isNaN(new Date(data.effective_from).getTime())
        ) {
          errors.push("effective_from is required and must be a valid date.");
        }

        // effective_to must be a valid date if provided
        if (data.effective_to && isNaN(new Date(data.effective_to).getTime())) {
          errors.push("effective_to must be a valid date.");
        }

        // approved_at must be a valid date if provided
        if (data.approved_at && isNaN(new Date(data.approved_at).getTime())) {
          errors.push("approved_at must be a valid date.");
        }

        // Validate status
        const validStatuses = [
          "draft",
          "under_review",
          "active",
          "inactive",
          "archived",
          "deprecated",
        ];
        if (!validStatuses.includes(data.status)) {
          errors.push(`status must be one of ${validStatuses.join(", ")}.`);
        }

        // Validate UUIDs for optional fields
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

        const uuidFields = ["approved_by", "created_by", "updated_by"];
        uuidFields.forEach((field) => {
          if (data[field] && !uuidRegex.test(data[field])) {
            errors.push(`${field} must be a valid UUID.`);
          }
        });

        return { isValid: errors.length === 0, errors };
      },
      PolicyAcknowledgment: (data) => {
        const errors = [];

        // Required fields
        if (!data.acknowledgment_id) errors.push("Missing acknowledgment_id.");
        if (!data.version_id) errors.push("Missing version_id.");
        if (!data.employee_id) errors.push("Missing employee_id.");

        // acknowledged_at must be a valid date
        if (
          !data.acknowledged_at ||
          isNaN(new Date(data.acknowledged_at).getTime())
        ) {
          errors.push("acknowledged_at is required and must be a valid date.");
        }

        // acknowledgment_type validation
        const validAcknowledgmentTypes = ["electronic", "written"];
        if (!validAcknowledgmentTypes.includes(data.acknowledgment_type)) {
          errors.push(
            `acknowledgment_type must be one of ${validAcknowledgmentTypes.join(", ")}.`
          );
        }

        // ip_address must be a valid IPv4 or IPv6 address if provided
        const ipRegex =
          /^(?:\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4}|:)$/;
        if (data.ip_address && !ipRegex.test(data.ip_address)) {
          errors.push("ip_address must be a valid IPv4 or IPv6 address.");
        }

        // user_agent must be a string if provided
        if (data.user_agent && typeof data.user_agent !== "string") {
          errors.push("user_agent must be a string.");
        }

        // comments must be a string if provided
        if (data.comments && typeof data.comments !== "string") {
          errors.push("comments must be a string.");
        }

        // Validate UUIDs for required fields
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        const uuidFields = ["acknowledgment_id", "version_id", "employee_id"];
        uuidFields.forEach((field) => {
          if (data[field] && !uuidRegex.test(data[field])) {
            errors.push(`${field} must be a valid UUID.`);
          }
        });

        return { isValid: errors.length === 0, errors };
      },
      LeavePolicyConfiguration: (data) => {
        const errors = [];

        // Required fields
        if (!data.config_id) errors.push("Missing config_id.");
        if (!data.module_id) errors.push("Missing module_id.");
        if (!data.org_id) errors.push("Missing org_id.");
        if (!data.leave_type) errors.push("Missing leave_type.");
        if (!data.accrual_frequency) errors.push("Missing accrual_frequency.");
        if (!data.days_per_year) errors.push("Missing days_per_year.");

        // Leave type validation
        const validLeaveTypes = [
          "sick",
          "casual",
          "earned",
          "maternity",
          "paternity",
          "unpaid",
          "compensatory",
          "causal",
        ];
        if (!validLeaveTypes.includes(data.leave_type)) {
          errors.push(
            `leave_type must be one of ${validLeaveTypes.join(", ")}.`
          );
        }

        // Accrual frequency validation
        const validAccrualFrequencies = [
          "monthly",
          "quarterly",
          "yearly",
          "anniversary",
        ];
        if (!validAccrualFrequencies.includes(data.accrual_frequency)) {
          errors.push(
            `accrual_frequency must be one of ${validAccrualFrequencies.join(", ")}.`
          );
        }

        // days_per_year must be a positive number
        if (
          isNaN(parseFloat(data.days_per_year)) ||
          parseFloat(data.days_per_year) <= 0
        ) {
          errors.push("days_per_year must be a positive decimal number.");
        }

        // min_days_per_request & max_days_per_request should be non-negative
        if (
          data.min_days_per_request !== undefined &&
          data.min_days_per_request < 0
        ) {
          errors.push("min_days_per_request must be a non-negative integer.");
        }
        if (
          data.max_days_per_request !== undefined &&
          data.max_days_per_request < 0
        ) {
          errors.push("max_days_per_request must be a non-negative integer.");
        }
        if (
          data.min_days_per_request !== undefined &&
          data.max_days_per_request !== undefined &&
          data.min_days_per_request > data.max_days_per_request
        ) {
          errors.push(
            "min_days_per_request cannot be greater than max_days_per_request."
          );
        }

        // min_notice_days, max_carry_forward_days, carry_forward_validity_months should be non-negative
        [
          "min_notice_days",
          "max_carry_forward_days",
          "carry_forward_validity_months",
        ].forEach((field) => {
          if (data[field] !== undefined && data[field] < 0) {
            errors.push(`${field} must be a non-negative integer.`);
          }
        });

        // encashment_limit should be a positive integer if provided
        if (data.encashment_limit !== undefined && data.encashment_limit < 0) {
          errors.push("encashment_limit must be a non-negative integer.");
        }

        // document_submission_days should be a positive integer if provided
        if (
          data.document_submission_days !== undefined &&
          data.document_submission_days < 0
        ) {
          errors.push(
            "document_submission_days must be a non-negative integer."
          );
        }

        // applicable_from_months should be non-negative
        if (data.applicable_from_months < 0) {
          errors.push("applicable_from_months must be a non-negative integer.");
        }

        // Boolean fields validation
        [
          "is_encashable",
          "requires_approval",
          "requires_documents",
          "prorata_basis",
        ].forEach((field) => {
          if (data[field] !== undefined && typeof data[field] !== "boolean") {
            errors.push(`${field} must be a boolean value.`);
          }
        });

        // Validate UUIDs
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        [
          "config_id",
          "module_id",
          "org_id",
          "created_by",
          "updated_by",
        ].forEach((field) => {
          if (data[field] && !uuidRegex.test(data[field])) {
            errors.push(`${field} must be a valid UUID.`);
          }
        });

        return { isValid: errors.length === 0, errors };
      },
      AttendanceSettings: (data) => {
        const errors = [];

        // Required fields
        if (!data.id) errors.push("Missing id.");
        if (!data.organizationId) errors.push("Missing organizationId.");
        if (!data.moduleId) errors.push("Missing moduleId.");

        // UUID validation
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        ["id", "organizationId", "moduleId", "createdBy", "updatedBy"].forEach(
          (field) => {
            if (data[field] && !uuidRegex.test(data[field])) {
              errors.push(`${field} must be a valid UUID.`);
            }
          }
        );

        // captureMethods validation
        const validCaptureMethods = ["web_app", "mobile_app", "biometric"];
        if (
          data.captureMethods &&
          !data.captureMethods.every((method) =>
            validCaptureMethods.includes(method)
          )
        ) {
          errors.push(
            `captureMethods must contain only valid values: ${validCaptureMethods.join(", ")}.`
          );
        }

        // shiftType validation
        const validShiftTypes = ["fixed", "flexible", "rotational"];
        if (!validShiftTypes.includes(data.shiftType)) {
          errors.push(
            `shiftType must be one of ${validShiftTypes.join(", ")}.`
          );
        }

        // geoFenceRadius should be a positive integer if provided
        if (data.geoFenceRadius !== undefined && data.geoFenceRadius < 0) {
          errors.push("geoFenceRadius must be a non-negative integer.");
        }

        // flexibleHours should be a non-negative integer if provided
        if (data.flexibleHours !== undefined && data.flexibleHours < 0) {
          errors.push("flexibleHours must be a non-negative integer.");
        }

        // halfDayHours should be a non-negative integer if provided
        if (data.halfDayHours !== undefined && data.halfDayHours < 0) {
          errors.push("halfDayHours must be a non-negative integer.");
        }

        // fullDayHours should be a positive decimal if provided
        if (
          data.fullDayHours !== undefined &&
          (isNaN(parseFloat(data.fullDayHours)) ||
            parseFloat(data.fullDayHours) <= 0)
        ) {
          errors.push("fullDayHours must be a positive decimal number.");
        }

        // breakDurationMinutes should be a positive integer
        if (data.breakDurationMinutes < 0) {
          errors.push("breakDurationMinutes must be a non-negative integer.");
        }

        // workDaysPerWeek should be between 1 and 7
        if (data.workDaysPerWeek < 1 || data.workDaysPerWeek > 7) {
          errors.push("workDaysPerWeek must be between 1 and 7.");
        }

        // overtime settings
        if (
          data.minimumOvertimeMinutes !== undefined &&
          data.minimumOvertimeMinutes < 0
        ) {
          errors.push("minimumOvertimeMinutes must be a non-negative integer.");
        }
        if (
          data.maxOvertimeHoursMonthly !== undefined &&
          data.maxOvertimeHoursMonthly < 0
        ) {
          errors.push(
            "maxOvertimeHoursMonthly must be a non-negative integer."
          );
        }

        // latePenaltyType validation
        const validPenaltyTypes = [
          "none",
          "leave_deduction",
          "salary_deduction",
        ];
        if (!validPenaltyTypes.includes(data.latePenaltyType)) {
          errors.push(
            `latePenaltyType must be one of ${validPenaltyTypes.join(", ")}.`
          );
        }

        // overtime multipliers should be positive decimals
        ["weekendOvertimeMultiplier", "holidayOvertimeMultiplier"].forEach(
          (field) => {
            if (
              data[field] !== undefined &&
              (isNaN(parseFloat(data[field])) || parseFloat(data[field]) <= 0)
            ) {
              errors.push(`${field} must be a positive decimal number.`);
            }
          }
        );

        // Boolean fields validation
        [
          "geoFencingEnabled",
          "overtimePolicyEnabled",
          "autoCheckoutEnabled",
          "regularizationAllowed",
        ].forEach((field) => {
          if (data[field] !== undefined && typeof data[field] !== "boolean") {
            errors.push(`${field} must be a boolean value.`);
          }
        });

        return { isValid: errors.length === 0, errors };
      },
      ShiftConfiguration: (data) => {
        const errors = [];

        // Required fields
        if (!data.shift_id) errors.push("Missing shift_id.");
        if (!data.org_id) errors.push("Missing org_id.");
        if (!data.shift_name) errors.push("Missing shift_name.");
        if (!data.shift_type) errors.push("Missing shift_type.");

        // UUID validation
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        ["shift_id", "org_id", "created_by", "updated_by"].forEach((field) => {
          if (data[field] && !uuidRegex.test(data[field])) {
            errors.push(`${field} must be a valid UUID.`);
          }
        });

        // shift_type validation
        const validShiftTypes = ["fixed", "flexible", "rotational"];
        if (!validShiftTypes.includes(data.shift_type)) {
          errors.push(
            `shift_type must be one of ${validShiftTypes.join(", ")}.`
          );
        }

        // shift_name length validation
        if (data.shift_name.length > 100) {
          errors.push("shift_name must not exceed 100 characters.");
        }

        // start_time and end_time validation (should be valid date-time format)
        // const dateTimeRegex =
        //   /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/; // YYYY-MM-DDTHH:MM:SS format
        // ["start_time", "end_time"].forEach((field) => {
        //   if (data[field] && !dateTimeRegex.test(data[field])) {
        //     errors.push(`${field} must be in YYYY-MM-DDTHH:MM:SS format.`);
        //   }
        // });

        // flexible_hours should be a positive integer if provided
        if (data.flexible_hours !== undefined && data.flexible_hours < 0) {
          errors.push("flexible_hours must be a non-negative integer.");
        }

        // break_duration should be a non-negative integer
        if (data.break_duration < 0) {
          errors.push("break_duration must be a non-negative integer.");
        }

        // grace_period_minutes should be a non-negative integer
        if (data.grace_period_minutes < 0) {
          errors.push("grace_period_minutes must be a non-negative integer.");
        }

        // half_day_hours and full_day_hours should be positive decimals if provided
        ["half_day_hours", "full_day_hours"].forEach((field) => {
          if (
            data[field] !== undefined &&
            (isNaN(parseFloat(data[field])) || parseFloat(data[field]) <= 0)
          ) {
            errors.push(`${field} must be a positive decimal number.`);
          }
        });

        // Boolean validation for status
        const validStatuses = ["active", "inactive"];
        if (!validStatuses.includes(data.status)) {
          errors.push(`status must be one of ${validStatuses.join(", ")}.`);
        }

        return { isValid: errors.length === 0, errors };
      },
      EmployeeShiftAssignment: (data) => {
        const errors = [];

        // Required fields
        if (!data.assignment_id) errors.push("Missing assignment_id.");
        if (!data.employee_id) errors.push("Missing employee_id.");
        if (!data.shift_id) errors.push("Missing shift_id.");
        if (!data.effective_from) errors.push("Missing effective_from.");

        // UUID validation
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        [
          "assignment_id",
          "employee_id",
          "shift_id",
          "created_by",
          "updated_by",
        ].forEach((field) => {
          if (data[field] && !uuidRegex.test(data[field])) {
            errors.push(`${field} must be a valid UUID.`);
          }
        });

        // effective_from and effective_to should be valid date formats
        const isValidDate = (date) => !isNaN(new Date(date).getTime());

        if (data.effective_from && !isValidDate(data.effective_from)) {
          errors.push("effective_from must be a valid date.");
        }
        if (data.effective_to && !isValidDate(data.effective_to)) {
          errors.push("effective_to must be a valid date.");
        }

        // effective_to should be after effective_from
        if (
          data.effective_from &&
          data.effective_to &&
          new Date(data.effective_from) >= new Date(data.effective_to)
        ) {
          errors.push("effective_to must be later than effective_from.");
        }

        return { isValid: errors.length === 0, errors };
      },
      HolidayCalendarYear: (data) => {
        const errors = [];

        // Required fields
        if (!data.calendar_id) errors.push("Missing calendar_id.");
        if (!data.org_id) errors.push("Missing org_id.");
        if (!data.year) errors.push("Missing year.");
        if (!data.start_date) errors.push("Missing start_date.");
        if (!data.end_date) errors.push("Missing end_date.");

        // UUID validation
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        ["calendar_id", "org_id"].forEach((field) => {
          if (data[field] && !uuidRegex.test(data[field])) {
            errors.push(`${field} must be a valid UUID.`);
          }
        });

        // Year validation (must be a four-digit year)
        const currentYear = new Date().getFullYear();
        if (
          typeof data.year !== "number" ||
          data.year < 1900 ||
          data.year > currentYear + 10
        ) {
          errors.push(
            "year must be a valid four-digit number within a reasonable range."
          );
        }

        // Date validation
        const isValidDate = (date) => !isNaN(new Date(date).getTime());

        if (!isValidDate(data.start_date)) {
          errors.push("start_date must be a valid date.");
        }
        if (!isValidDate(data.end_date)) {
          errors.push("end_date must be a valid date.");
        }

        // end_date must be after start_date
        if (
          data.start_date &&
          data.end_date &&
          new Date(data.start_date) >= new Date(data.end_date)
        ) {
          errors.push("end_date must be later than start_date.");
        }

        return { isValid: errors.length === 0, errors };
      },
      HolidayMaster: (data) => {
        const errors = [];

        // Required fields
        if (!data.holiday_id) errors.push("Missing holiday_id.");
        if (!data.org_id) errors.push("Missing org_id.");
        if (!data.holiday_name) errors.push("Missing holiday_name.");
        if (!data.holiday_type) errors.push("Missing holiday_type.");
        if (!data.recurrence_type) errors.push("Missing recurrence_type.");

        // UUID validation
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        ["holiday_id", "org_id"].forEach((field) => {
          if (data[field] && !uuidRegex.test(data[field])) {
            errors.push(`${field} must be a valid UUID.`);
          }
        });

        // Holiday name length validation
        if (
          typeof data.holiday_name !== "string" ||
          data.holiday_name.trim().length === 0
        ) {
          errors.push("holiday_name must be a non-empty string.");
        }
        if (data.holiday_name.length > 100) {
          errors.push("holiday_name must not exceed 100 characters.");
        }

        // Enum validation for holiday_type
        const validHolidayTypes = [
          "public",
          "religious",
          "regional",
          "national",
          "work",
          "optional",
          "company_specific",
        ];
        if (!validHolidayTypes.includes(data.holiday_type)) {
          errors.push(
            `holiday_type must be one of: ${validHolidayTypes.join(", ")}.`
          );
        }

        // Enum validation for recurrence_type
        const validRecurrenceTypes = [
          "yearly_fixed_date",
          "yearly_variable_date",
          "one_time",
        ];
        if (!validRecurrenceTypes.includes(data.recurrence_type)) {
          errors.push(
            `recurrence_type must be one of: ${validRecurrenceTypes.join(", ")}.`
          );
        }

        return { isValid: errors.length === 0, errors };
      },
      HolidayCalendarDetail: (data) => {
        const errors = [];

        // Required fields
        if (!data.calendar_detail_id)
          errors.push("Missing calendar_detail_id.");
        if (!data.calendar_id) errors.push("Missing calendar_id.");
        if (!data.holiday_id) errors.push("Missing holiday_id.");
        if (!data.holiday_date) errors.push("Missing holiday_date.");

        // UUID validation
        const uuidRegex =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        ["calendar_detail_id", "calendar_id", "holiday_id"].forEach((field) => {
          if (data[field] && !uuidRegex.test(data[field])) {
            errors.push(`${field} must be a valid UUID.`);
          }
        });

        // Date validation
        if (isNaN(Date.parse(data.holiday_date))) {
          errors.push("holiday_date must be a valid date.");
        }

        // Boolean validation for is_half_day
        if (typeof data.is_half_day !== "boolean") {
          errors.push("is_half_day must be a boolean value.");
        }

        // Enum validation for half_day_type (if provided)
        const validHalfDayTypes = ["first_half", "second_half", "none"];
        if (
          data.half_day_type &&
          !validHalfDayTypes.includes(data.half_day_type)
        ) {
          errors.push(
            `half_day_type must be one of: ${validHalfDayTypes.join(", ")}.`
          );
        }

        return { isValid: errors.length === 0, errors };
      },
    };
  }

  /**
   * Validates email format
   * @param {string} email
   * @returns {boolean}
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPAN(pan) {
    // PAN format: AAAAA9999A (5 letters, 4 numbers, 1 letter)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  }

  static isValidTAN(tan) {
    // TAN format: AAAA99999A (4 letters, 5 numbers, 1 letter)
    const tanRegex = /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/;
    return tanRegex.test(tan);
  }

  /**
   * Validates CIN format
   * @param {string} cin
   * @returns {boolean}
   */
  isValidCIN(cin) {
    const cinRegex = /^[LU][A-Za-z0-9]{20}$/i;
    return cinRegex.test(cin);
  }

  determineObjectType(data) {
    if (
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("legal_entity_name")
    ) {
      return "Organization";
    } else if (
      data.hasOwnProperty("bank_id") &&
      data.hasOwnProperty("bank_name")
    ) {
      return "BankMaster";
    } else if (
      data.hasOwnProperty("country_id") &&
      data.hasOwnProperty("country_code")
    ) {
      return "CountryMaster";
    } else if (
      data.hasOwnProperty("state_id") &&
      data.hasOwnProperty("state_code")
    ) {
      return "StateMaster";
    } else if (
      data.hasOwnProperty("location_id") &&
      data.hasOwnProperty("location_name")
    ) {
      return "OrganizationLocation";
    } else if (
      data.hasOwnProperty("org_bank_id") &&
      data.hasOwnProperty("account_number")
    ) {
      return "OrganizationBankDetail";
    } else if (
      data.hasOwnProperty("org_compliance_id") &&
      data.hasOwnProperty("compliance_code")
    ) {
      return "OrganizationComplianceDetail";
    } else if (
      data.hasOwnProperty("dept_type_id") &&
      data.hasOwnProperty("type_name")
    ) {
      return "DepartmentType";
    } else if (
      data.hasOwnProperty("dept_id") &&
      data.hasOwnProperty("dept_type_id")
    ) {
      return "Department";
    } else if (
      data.hasOwnProperty("employment_type_id") &&
      data.hasOwnProperty("type_name")
    ) {
      return "EmploymentType";
    } else if (
      data.hasOwnProperty("job_title_id") &&
      data.hasOwnProperty("title_name")
    ) {
      return "JobTitle";
    } else if (
      data.hasOwnProperty("employee_id") &&
      data.hasOwnProperty("employee_number")
    ) {
      return "Employee";
    } else if (
      data.hasOwnProperty("empl_personal_det_id") &&
      data.hasOwnProperty("employee_id")
    ) {
      return "EmployeePersonalDetail";
    } else if (
      data.hasOwnProperty("employee_bank_id") &&
      data.hasOwnProperty("bank_id")
    ) {
      return "EmployeeBankDetail";
    } else if (
      data.hasOwnProperty("empl_financial_id") &&
      data.hasOwnProperty("employee_id")
    ) {
      return "EmployeeFinancialDetail";
    } else if (
      data.hasOwnProperty("component_id") &&
      data.hasOwnProperty("component_name")
    ) {
      return "SalaryComponentMaster";
    } else if (
      data.hasOwnProperty("structure_id") &&
      data.hasOwnProperty("structure_name")
    ) {
      return "SalaryStructure";
    } else if (
      data.hasOwnProperty("structure_component_id") &&
      data.hasOwnProperty("component_id")
    ) {
      return "SalaryStructureComponent";
    } else if (
      data.hasOwnProperty("salary_id") &&
      data.hasOwnProperty("employee_id")
    ) {
      return "EmployeeSalary";
    } else if (
      data.hasOwnProperty("cycle_id") &&
      data.hasOwnProperty("cycle_name")
    ) {
      return "PayrollCycle";
    } else if (
      data.hasOwnProperty("run_id") &&
      data.hasOwnProperty("start_date")
    ) {
      return "PayrollRun";
    } else if (
      data.hasOwnProperty("module_id") &&
      data.hasOwnProperty("module_name")
    ) {
      return "PolicyModule";
    } else if (
      data.hasOwnProperty("setting_id") &&
      data.hasOwnProperty("setting_name")
    ) {
      return "PolicySetting";
    } else if (
      data.hasOwnProperty("policy_id") &&
      data.hasOwnProperty("probation_code")
    ) {
      return "ProbationPolicy";
    } else if (
      data.hasOwnProperty("version_id") &&
      data.hasOwnProperty("version_number") &&
      data.hasOwnProperty("module_id")
    ) {
      return "PolicyDocumentVersion";
    } else if (
      data.hasOwnProperty("acknowledgment_id") &&
      data.hasOwnProperty("version_id") &&
      data.hasOwnProperty("employee_id")
    ) {
      return "PolicyAcknowledgment";
    } else if (
      data.hasOwnProperty("config_id") &&
      data.hasOwnProperty("module_id")
    ) {
      return "LeavePolicyConfiguration";
    } else if (
      data.hasOwnProperty("id") &&
      data.hasOwnProperty("organizationId") &&
      data.hasOwnProperty("moduleId") &&
      data.hasOwnProperty("captureMethods")
    ) {
      return "AttendanceSettings";
    } else if (
      data.hasOwnProperty("shift_id") &&
      data.hasOwnProperty("org_id")
    ) {
      return "ShiftConfiguration";
    } else if (
      data.hasOwnProperty("assignment_id") &&
      data.hasOwnProperty("employee_id")
    ) {
      return "EmployeeShiftAssignment";
    } else if (
      data.hasOwnProperty("calendar_id") &&
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("year") &&
      data.hasOwnProperty("start_date")
    ) {
      return "HolidayCalendarYear";
    } else if (
      data.hasOwnProperty("holiday_id") &&
      data.hasOwnProperty("org_id") &&
      data.hasOwnProperty("holiday_name")
    ) {
      return "HolidayMaster";
    } else if (
      data.hasOwnProperty("calendar_detail_id") &&
      data.hasOwnProperty("calendar_id") &&
      data.hasOwnProperty("holiday_id") &&
      data.hasOwnProperty("holiday_date")
    ) {
      return "HolidayCalendarDetail";
    } else if (
      data.hasOwnProperty("org_tax_id") &&
      data.hasOwnProperty("org_id") &&
      (data.hasOwnProperty("pan") || data.hasOwnProperty("tan"))
    ) {
      return "OrganizationTaxDetail";
    } else {
      return "unknown";
    }
  }

  validate(data) {
    try {
      const objectType = this.determineObjectType(data);

      if (objectType === "unknown") {
        return { isValid: false, errors: ["Unknown object type"] };
      }

      if (!this.validators[objectType]) {
        return {
          isValid: false,
          errors: [`No validator found for object type: ${objectType}`],
        };
      }

      return this.validators[objectType](data);
    } catch (error) {
      logger.error({
        message: "Error validating data",
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
          },
          data: data,
        },
        timestamp: new Date().toISOString(),
      });

      return { isValid: false, errors: [error.message] };
    }
  }
}

module.exports = new ValidationService();
