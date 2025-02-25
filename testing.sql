-- Enable btree_gist extension for using GIST with scalar types
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "document_type_enum" AS ENUM (
  'aadhar',
  'pan',
  'passport',
  'driving_license',
  'voter_id',
  'bank_statement',
  'salary_slip',
  'experience_letter',
  'education_certificate',
  'other'
);

CREATE TYPE "account_type_enum" AS ENUM (
  'savings',
  'current',
  'salary'
);

CREATE TYPE "employment_type_enum" AS ENUM (
  'permanent',
  'contract',
  'intern',
  'consultant',
  'probation'
);

CREATE TYPE "leave_type_enum" AS ENUM (
  'sick',
  'casual',
  'earned',
  'maternity',
  'paternity',
  'unpaid',
  'compensatory'
);

CREATE TYPE "status_enum" AS ENUM (
  'active',
  'inactive',
  'suspended',
  'deleted'
);

CREATE TYPE "gender_enum" AS ENUM (
  'male',
  'female',
  'other'
);

CREATE TYPE "employment_status_enum" AS ENUM (
  'active',
  'inactive',
  'on_notice',
  'terminated',
  'suspended'
);

CREATE TYPE "verification_status_enum" AS ENUM (
  'pending',
  'verified',
  'rejected'
);

CREATE TYPE "marital_status_enum" AS ENUM (
  'single',
  'married',
  'divorced',
  'widowed'
);

CREATE TYPE "address_type_enum" AS ENUM (
  'permanent',
  'current'
);

CREATE TYPE "bank_type_enum" AS ENUM (
  'organization_bank',
  'employee_bank'
);

CREATE TYPE "capture_method_enum" AS ENUM (
  'biometric',
  'mobile_app',
  'web_app'
);

CREATE TYPE "shift_type_enum" AS ENUM (
  'fixed',
  'flexible',
  'rotational'
);

CREATE TYPE "penalty_type_enum" AS ENUM (
  'none',
  'leave_deduction',
  'salary_deduction'
);
CREATE TYPE "late_penalty_count_frequency" AS ENUM (
  'daily',
  'weekly',
  'monthly'
);

CREATE TYPE "frequency_enum" AS ENUM (
  'daily',
  'weekly',
  'monthly'
);
CREATE TYPE "overtime_calculation_type_enum" AS ENUM (
  'daily',
  'weekly',
  'monthly'
);
CREATE TYPE "late_penalty_count_frequency_enum" AS ENUM (
  'daily',
  'weekly',
  'monthly'
);

-- Leave Request Status
CREATE TYPE "leave_request_status_enum" AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'withdrawn'
);

-- Leave Accrual Frequency
CREATE TYPE "leave_accrual_frequency_enum" AS ENUM (
  'monthly',
  'quarterly',
  'yearly',
  'anniversary'
);

-- Leave Balance Update Type
CREATE TYPE "leave_balance_update_type_enum" AS ENUM (
  'accrual',
  'adjustment',
  'expiry',
  'carry_forward',
  'leave_taken'
);

-- Attendance Status
CREATE TYPE "attendance_status_enum" AS ENUM (
  'present',
  'absent',
  'half_day',
  'on_leave',
  'holiday',
  'weekend',
  'work_from_home'
);

-- Attendance Regularization Status
CREATE TYPE "regularization_status_enum" AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

-- Holiday types classification
CREATE TYPE "holiday_type_enum" AS ENUM (
  'public',        -- Government declared public holidays
  'religious',     -- Religious festivals and celebrations
  'regional',      -- State or region specific holidays
  'company_specific', -- Organization specific holidays
  'optional'       -- Holidays that employees can choose from
);

CREATE TYPE "holiday_recurrence_enum" AS ENUM (
  'yearly_fixed_date',      -- Same date every year (e.g. Jan 1)
  'yearly_variable_date',   -- Different date each year (e.g. Easter)
  'one_time'               -- One-time holiday
);
-- Payroll Process Status
CREATE TYPE "payroll_status_enum" AS ENUM (
  'draft',
  'processing',
  'review_pending',
  'approved',
  'rejected',
  'completed',
  'cancelled'
);
-- Policy Categories Enum
CREATE TYPE "policy_category_enum" AS ENUM (
  'employment',      -- Employment related policies
  'leave',          -- Leave management policies
  'attendance',     -- Attendance and time tracking
  'payroll',        -- Salary and compensation
  'benefits',       -- Employee benefits
  'compliance',     -- Legal and regulatory compliance
  'performance',    -- Performance management
  'training',       -- Training and development
  'it_security',    -- IT and security policies
  'general'         -- General organizational policies
);

-- Policy Status Enum
CREATE TYPE "policy_status_enum" AS ENUM (
  'draft',
  'under_review',
  'active',
  'archived',
  'deprecated'
);

-- Salary Component Categories (e.g., Earnings, Deductions, Statutory)
CREATE TYPE "component_category_enum" AS ENUM ('earnings', 'deductions', 'statutory', 'reimbursements', 'bonus');

-- Salary Component Types (e.g., Fixed, Variable, Adhoc)
CREATE TYPE "component_type_enum" AS ENUM ('fixed', 'variable', 'adhoc', 'calculated');

-- Calculation Frequency
CREATE TYPE "calculation_frequency_enum" AS ENUM ('monthly', 'quarterly', 'annually', 'one_time');

CREATE TABLE "bank_master" (
  "bank_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bank_type" bank_type_enum NOT NULL,
  "bank_name" varchar(100) NOT NULL,
  "bank_code" varchar(20) UNIQUE NOT NULL,
  "swift_code" varchar(11),
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);
CREATE TABLE "country_master" (
  "country_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "country_code" varchar(3) UNIQUE NOT NULL,
  "country_name" varchar(100) NOT NULL,
  "dial_code" varchar(5) NOT NULL,
  "currency_code" varchar(3) NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "state_master" (
  "state_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "country_id" uuid,
  "state_code" varchar(10) NOT NULL,
  "state_name" varchar(100) NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "organizations" (
  "org_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "legal_entity_name" varchar(255) NOT NULL,
  "auth_signatory_name" varchar(255) NOT NULL,
  "auth_signatory_designation" varchar(255) NOT NULL,
  "auth_signatory_email" varchar(255) NOT NULL,
  "auth_signatory_father_name" varchar(255),
  "corporation_date" date NOT NULL,
  "cin" varchar(21) NOT NULL,
  "status" status_enum NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

-- Organization Locations Table
CREATE TABLE "organization_locations" (
  "location_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("org_id") ON DELETE CASCADE,
  "location_name" varchar(100) NOT NULL,
  "location_code" varchar(50) NOT NULL,
  "is_head_office" boolean DEFAULT false,
  "is_registered_office" boolean DEFAULT false,
  "is_branch" boolean DEFAULT true,
  "address_line1" varchar(255) NOT NULL,
  "address_line2" varchar(255),
  "locality" varchar(100),
  "city" varchar(100) NOT NULL,
  "state" varchar(100) NOT NULL,
  "country" varchar(100) NOT NULL,
  "pincode" varchar(10) NOT NULL,
  "email" varchar(255),
  "phone" varchar(20),
  "gstin" varchar(15),
  "timezone" varchar(50) NOT NULL,
  "status" status_enum NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "unique_location_code_org" UNIQUE ("org_id", "location_code"),
  CONSTRAINT "unique_org_location_name" UNIQUE ("org_id", "location_name"),
  CONSTRAINT "single_registered_office" EXCLUDE USING btree (org_id WITH =) WHERE (is_registered_office = true)
);



CREATE TABLE "organization_bank_details" (
  "org_bank_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid,
  "bank_id" uuid,
  "account_number" varchar UNIQUE NOT NULL,
  "account_type" varchar,
  "ifsc_code" varchar NOT NULL,
  "branch_name" varchar NOT NULL,
  "name_on_account" varchar NOT NULL,
  "is_primary" boolean DEFAULT false,
  "status" varchar,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "organization_tax_details" (
  "org_tax_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid,
  "pan" varchar UNIQUE,
  "tan" varchar UNIQUE,
  "tan_circle_number" varchar,
  "corporate_income_tax_location" varchar,
  "created_at" timestamp
);

CREATE TABLE "organization_compliance_details" (
  "org_compliance_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid,
  "compliance_code" varchar(3) UNIQUE NOT NULL,
  "pf_establishment_id" varchar(50) UNIQUE,
  "pf_number" varchar(50) UNIQUE NOT NULL,
  "pf_registration_date" date NOT NULL,
  "esi_number" varchar(50) UNIQUE,
  "esi_registration_date" date,
  "pt_establishment_id" varchar(50) UNIQUE,
  "pt_number" varchar(50) UNIQUE,
  "pt_registration_date" date,
  "lwf_establishment_id" varchar(50) UNIQUE,
  "lwf_registration_date" date,
  "status" status_enum NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);





CREATE TABLE "department_types" (
  "dept_type_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type_name" varchar(50) UNIQUE NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "departments" (
  "dept_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid,
  "dept_type_id" uuid,
  "dept_code" varchar(20) UNIQUE NOT NULL,
  "dept_name" varchar(100) NOT NULL,
  "parent_dept_id" uuid,
  "cost_center_code" varchar(50),
  "description" text,
  "status" status_enum NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "employees" (
  "employee_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid,
  "employee_number" varchar(50) UNIQUE NOT NULL,
  "employment_type_id" uuid,
  "dept_id" uuid,
  "work_location_id" uuid REFERENCES "organization_locations" ("location_id") ON DELETE SET NULL,
  "job_title_id" uuid,
  "title" varchar(10),
  "first_name" varchar(50) NOT NULL,
  "middle_name" varchar(50),
  "last_name" varchar(50) NOT NULL,
  "display_name" varchar(100) NOT NULL,
  "date_of_birth" date NOT NULL,
  "gender" gender_enum NOT NULL,
  "official_email" varchar(255) UNIQUE NOT NULL,
  "personal_email" varchar(255) UNIQUE,
  "mobile_number" varchar(15) NOT NULL,
  "emergency_contact_name" varchar(100),
  "emergency_contact_relationship" varchar(50),
  "emergency_contact_number" varchar(15),
  "date_joined" date NOT NULL,
  "probation_end_date" date,
  "confirmation_date" date,
  "contract_end_date" date,
  "reporting_manager_id" uuid,
  "notice_period_days" integer DEFAULT 0,
  "status" employment_status_enum NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "employment_types" (
  "employment_type_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type_name" varchar NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "job_titles" (
  "job_title_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid,
  "title_name" varchar NOT NULL,
  "title_description" text,
  "grade_level" integer,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "employee_personal_details" (
  "empl_personal_det_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid,
  "marital_status" marital_status_enum,
  "marriage_date" date,
  "blood_group" varchar(5),
  "nationality" varchar(50) NOT NULL,
  "physically_challenged" boolean DEFAULT false,
  "disability_details" text,
  "father_name" varchar(100) NOT NULL,
  "mother_name" varchar(100) NOT NULL,
  "spouse_name" varchar(100),
  "spouse_gender" gender_enum,
  "residence_number" varchar(15),
  "social_media_handles" jsonb,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);



CREATE TABLE "employee_financial_details" (
  "empl_financial_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid UNIQUE,
  "compliance_id" uuid,
  "employee_bank_id" uuid,
  "salary_payment_mode" varchar,
  "pf_details_available" boolean,
  "pf_number" varchar UNIQUE,
  "pf_joining_date" date,
  "employee_contribution_to_pf" varchar,
  "uan" varchar UNIQUE,
  "esi_details_available" boolean,
  "esi_eligible" boolean,
  "employer_esi_number" varchar UNIQUE,
  "lwf_eligible" boolean,
  "aadhar_number" varchar UNIQUE,
  "dob_in_aadhar" date,
  "full_name_in_aadhar" varchar,
  "gender_in_aadhar" varchar,
  "pan_available" boolean,
  "pan_number" varchar UNIQUE,
  "full_name_in_pan" varchar,
  "dob_in_pan" varchar,
  "parents_name_in_pan" varchar,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "employee_bank_details" (
  "employee_bank_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid,
  "bank_id" uuid,
  "account_number" varchar UNIQUE NOT NULL,
  "account_type" varchar,
  "ifsc_code" varchar NOT NULL,
  "branch_name" varchar NOT NULL,
  "name_on_account" varchar NOT NULL,
  "is_primary" boolean DEFAULT false,
  "status" varchar,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

-- Employee Residential Addresses Table
CREATE TABLE "employee_residential_addresses" (
  "address_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL,
  "address_type" address_type_enum NOT NULL,
  "is_primary" boolean DEFAULT false,
  "country_id" uuid NOT NULL,
  "state_id" uuid NOT NULL,
  "address_line1" text NOT NULL,
  "address_line2" text,
  "city" varchar(100) NOT NULL,
  "zip" varchar(10) NOT NULL,
  "status" status_enum NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "emp_address_employee_fk" FOREIGN KEY ("employee_id") 
    REFERENCES "employees" ("employee_id") ON DELETE CASCADE,
  CONSTRAINT "emp_address_country_fk" FOREIGN KEY ("country_id") 
    REFERENCES "country_master" ("country_id"),
  CONSTRAINT "emp_address_state_fk" FOREIGN KEY ("state_id") 
    REFERENCES "state_master" ("state_id")
);
-- Enhanced Salary Components Master
CREATE TABLE "salary_components_master" (
  "component_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("org_id") ON DELETE CASCADE,
  "component_name" varchar(100) NOT NULL,
  "component_code" varchar(20) NOT NULL,
  "component_category" component_category_enum NOT NULL,
  "component_type" component_type_enum NOT NULL,
  "calculation_type" varchar(50) NOT NULL,
  "calculation_basis" varchar(50),
  "calculation_formula" text,
  "calculation_frequency" calculation_frequency_enum DEFAULT 'monthly',
  "is_taxable" boolean DEFAULT false,
  "consider_for_ctc" boolean DEFAULT true,
  "consider_for_esi" boolean DEFAULT false,
  "consider_for_pf" boolean DEFAULT false,
  "consider_for_bonus" boolean DEFAULT false,
  "min_value" decimal(15,2),
  "max_value" decimal(15,2),
  "rounding_factor" integer DEFAULT 0,
  "print_name" varchar(100),
  "description" text,
  "status" status_enum DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "unique_component_code_org" UNIQUE ("org_id", "component_code")
);
-- Enhanced Salary Structures
CREATE TABLE "salary_structures" (
  "structure_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("org_id") ON DELETE CASCADE,
  "structure_name" varchar(100) NOT NULL,
  "structure_code" varchar(20) NOT NULL,
  "description" text,
  "min_ctc" decimal(15,2),
  "max_ctc" decimal(15,2),
  "effective_from" date NOT NULL,
  "effective_to" date,
  "is_default" boolean DEFAULT false,
  "status" status_enum DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "unique_structure_code_org" UNIQUE ("org_id", "structure_code")
);

-- Enhanced Salary Structure Components
CREATE TABLE "salary_structure_components" (
  "structure_component_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "structure_id" uuid NOT NULL REFERENCES "salary_structures"("structure_id") ON DELETE CASCADE,
  "component_id" uuid NOT NULL REFERENCES "salary_components_master"("component_id") ON DELETE RESTRICT,
  "calculation_priority" integer NOT NULL DEFAULT 0,
  "percentage_of_basic" decimal(5,2),
  "percentage_of_ctc" decimal(5,2),
  "min_value" decimal(15,2),
  "max_value" decimal(15,2),
  "default_value" decimal(15,2),
  "is_mandatory" boolean DEFAULT true,
  "status" status_enum DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "unique_component_in_structure" UNIQUE ("structure_id", "component_id")
);

-- Enhanced Employee Salaries
CREATE TABLE "employee_salaries" (
  "salary_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "employees"("employee_id") ON DELETE CASCADE,
  "structure_id" uuid NOT NULL REFERENCES "salary_structures"("structure_id") ON DELETE RESTRICT,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "annual_ctc" decimal(15,2) NOT NULL,
  "monthly_ctc" decimal(15,2) NOT NULL,
  "basic_percent" decimal(5,2) NOT NULL,
  "hra_percent" decimal(5,2),
  "revision_type" varchar(50),
  "revision_reason" text,
  "status" status_enum DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "no_overlapping_salaries" EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_from, effective_to, '[)') WITH &&
  )
);


-- Enhanced Policy Modules Table
CREATE TABLE "policy_modules" (
  "module_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("org_id") ON DELETE CASCADE,
  "module_name" varchar(100) NOT NULL,
  "module_code" varchar(50) NOT NULL,
  "module_category" policy_category_enum NOT NULL,
  "module_description" text,
  "version" varchar(20) NOT NULL DEFAULT '1.0.0',
  "is_mandatory" boolean DEFAULT false,
  "status" policy_status_enum NOT NULL DEFAULT 'draft',
  "effective_from" date NOT NULL,
  "effective_to" date,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  "created_by" uuid REFERENCES "employees"("employee_id"),
  "updated_by" uuid REFERENCES "employees"("employee_id"),
  CONSTRAINT "unique_module_code_org" UNIQUE ("org_id", "module_code"),
  CONSTRAINT "valid_effective_dates" CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- Enhanced Policy Settings Table
CREATE TABLE "policy_settings" (
  "setting_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "module_id" uuid NOT NULL REFERENCES "policy_modules"("module_id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations"("org_id") ON DELETE CASCADE,
  "setting_name" varchar(100) NOT NULL,
  "setting_key" varchar(50) NOT NULL,
  "setting_value" jsonb NOT NULL,
  "setting_type" varchar(50) NOT NULL,
  "is_encrypted" boolean DEFAULT false,
  "is_configurable" boolean DEFAULT true,
  "validation_rules" jsonb,
  "default_value" jsonb,
  "description" text,
  "status" status_enum DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  "created_by" uuid REFERENCES "employees"("employee_id"),
  "updated_by" uuid REFERENCES "employees"("employee_id"),
  CONSTRAINT "unique_setting_key_module" UNIQUE ("module_id", "setting_key")
);

-- Enhanced Probation Policies Table
CREATE TABLE "probation_policies" (
  "policy_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("org_id") ON DELETE CASCADE,
  "employment_type_id" uuid REFERENCES "employment_types"("employment_type_id"),
  "probation_period_months" integer NOT NULL CHECK (probation_period_months > 0),
  "min_extension_months" integer NOT NULL DEFAULT 1,
  "max_extension_months" integer,
  "extension_allowed" boolean DEFAULT true,
  "max_extensions" integer DEFAULT 1,
  "auto_confirm" boolean DEFAULT false,
  "notice_period_days" integer DEFAULT 30,
  "review_required" boolean DEFAULT true,
  "review_before_days" integer DEFAULT 15,
  "status" status_enum DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  "created_by" uuid REFERENCES "employees"("employee_id"),
  "updated_by" uuid REFERENCES "employees"("employee_id"),
  CONSTRAINT "valid_extension_months" CHECK (max_extension_months IS NULL OR max_extension_months >= min_extension_months),
  CONSTRAINT "unique_employment_type_policy" UNIQUE ("org_id", "employment_type_id")
);

-- Policy Document Versions Table
CREATE TABLE "policy_document_versions" (
  "version_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "module_id" uuid NOT NULL REFERENCES "policy_modules"("module_id") ON DELETE CASCADE,
  "version_number" varchar(20) NOT NULL,
  "document_url" text NOT NULL,
  "change_summary" text,
  "status" policy_status_enum NOT NULL DEFAULT 'draft',
  "effective_from" date NOT NULL,
  "effective_to" date,
  "approved_at" timestamp,
  "approved_by" uuid REFERENCES "employees"("employee_id"),
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  "created_by" uuid REFERENCES "employees"("employee_id"),
  "updated_by" uuid REFERENCES "employees"("employee_id"),
  CONSTRAINT "unique_version_module" UNIQUE ("module_id", "version_number")
);

-- Policy Acknowledgments Table
CREATE TABLE "policy_acknowledgments" (
  "acknowledgment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "version_id" uuid NOT NULL REFERENCES "policy_document_versions"("version_id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("employee_id") ON DELETE CASCADE,
  "acknowledged_at" timestamp NOT NULL DEFAULT (now()),
  "acknowledgment_type" varchar(50) NOT NULL DEFAULT 'electronic',
  "ip_address" varchar(45),
  "user_agent" text,
  "comments" text,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "unique_version_employee" UNIQUE ("version_id", "employee_id")
);

-- Policy Location Applicability Table
CREATE TABLE "policy_location_applicability" (
  "applicability_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "module_id" uuid NOT NULL REFERENCES "policy_modules"("module_id") ON DELETE CASCADE,
  "location_id" uuid NOT NULL REFERENCES "organization_locations"("location_id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT (now()),
  "created_by" uuid REFERENCES "employees"("employee_id"),
  CONSTRAINT "unique_policy_location" UNIQUE ("module_id", "location_id")
);

-- Policy Department Applicability Table
CREATE TABLE "policy_department_applicability" (
  "applicability_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "module_id" uuid NOT NULL REFERENCES "policy_modules"("module_id") ON DELETE CASCADE,
  "dept_id" uuid NOT NULL REFERENCES "departments"("dept_id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT (now()),
  "created_by" uuid REFERENCES "employees"("employee_id"),
  CONSTRAINT "unique_policy_department" UNIQUE ("module_id", "dept_id")
);



-- Leave Policy Configuration Table
CREATE TABLE "leave_policy_configurations" (
  "config_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "module_id" uuid NOT NULL REFERENCES "policy_modules"("module_id") ON DELETE CASCADE,
  "org_id" uuid NOT NULL REFERENCES "organizations"("org_id") ON DELETE CASCADE,
  "leave_type" leave_type_enum NOT NULL,
  "accrual_frequency" leave_accrual_frequency_enum NOT NULL,
  "days_per_year" decimal(5,2) NOT NULL,
  "min_days_per_request" integer,
  "max_days_per_request" integer,
  "min_notice_days" integer DEFAULT 0,
  "max_carry_forward_days" integer DEFAULT 0,
  "carry_forward_validity_months" integer DEFAULT 12,
  "is_encashable" boolean DEFAULT false,
  "encashment_limit" integer,
  "requires_approval" boolean DEFAULT true,
  "requires_documents" boolean DEFAULT false,
  "document_submission_days" integer,
  "applicable_from_months" integer DEFAULT 0,
  "prorata_basis" boolean DEFAULT true,
  "status" status_enum DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  "created_by" uuid REFERENCES "employees"("employee_id"),
  "updated_by" uuid REFERENCES "employees"("employee_id"),
  CONSTRAINT "unique_leave_type_org" UNIQUE ("org_id", "leave_type")
);

-- Leave Balances Table
CREATE TABLE "leave_balances" (
  "balance_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "employees"("employee_id") ON DELETE CASCADE,
  "leave_type" leave_type_enum NOT NULL,
  "year" integer NOT NULL,
  "total_entitled" decimal(5,2) NOT NULL,
  "carried_forward" decimal(5,2) DEFAULT 0,
  "accrued" decimal(5,2) DEFAULT 0,
  "used" decimal(5,2) DEFAULT 0,
  "pending" decimal(5,2) DEFAULT 0,
  "available" decimal(5,2) NOT NULL,
  "carried_forward_expiry" date,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "unique_employee_leave_year" UNIQUE ("employee_id", "leave_type", "year")
);

-- Leave Balance History Table
CREATE TABLE "leave_balance_history" (
  "history_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "balance_id" uuid NOT NULL REFERENCES "leave_balances"("balance_id") ON DELETE CASCADE,
  "update_type" leave_balance_update_type_enum NOT NULL,
  "amount" decimal(5,2) NOT NULL,
  "reference_id" uuid,
  "notes" text,
  "created_at" timestamp DEFAULT (now()),
  "created_by" uuid REFERENCES "employees"("employee_id")
);

-- Leave Requests Table
CREATE TABLE "leave_requests" (
  "request_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "employees"("employee_id") ON DELETE CASCADE,
  "leave_type" leave_type_enum NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "duration_days" decimal(5,2) NOT NULL,
  "first_day_half" boolean DEFAULT false,
  "last_day_half" boolean DEFAULT false,
  "reason" text,
  "contact_details" jsonb,
  "document_urls" text[],
  "status" leave_request_status_enum NOT NULL DEFAULT 'pending',
  "cancellation_reason" text,
  "rejection_reason" text,
  "approved_by" uuid REFERENCES "employees"("employee_id"),
  "approved_at" timestamp,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "valid_leave_dates" CHECK (end_date >= start_date)
);

-- Leave Request Workflow Table
CREATE TABLE "leave_request_workflow" (
  "workflow_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_id" uuid NOT NULL REFERENCES "leave_requests"("request_id") ON DELETE CASCADE,
  "approver_id" uuid NOT NULL REFERENCES "employees"("employee_id"),
  "approval_order" integer NOT NULL,
  "status" leave_request_status_enum NOT NULL DEFAULT 'pending',
  "comments" text,
  "acted_at" timestamp,
  "created_at" timestamp DEFAULT (now()),
  CONSTRAINT "unique_request_approver_order" UNIQUE ("request_id", "approval_order")
);

-- Attendance Settings Table
CREATE TABLE "attendance_settings" (
  "setting_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("org_id") ON DELETE CASCADE,
  "module_id" uuid NOT NULL REFERENCES "policy_modules"("module_id") ON DELETE CASCADE,
  "capture_method" capture_method_enum[] NOT NULL DEFAULT '{web_app}',
  "geo_fencing_enabled" boolean DEFAULT false,
  "geo_fence_radius" integer,
  "shift_type" shift_type_enum NOT NULL DEFAULT 'fixed',
  "shift_start_time" time,
  "shift_end_time" time,
  "flexible_hours" integer,
  "grace_period_minutes" integer DEFAULT 0,
  "half_day_hours" integer,
  "full_day_hours" decimal(4,2),
  "break_duration_minutes" integer DEFAULT 60,
  "work_days_per_week" integer DEFAULT 5,
  "overtime_policy_enabled" boolean DEFAULT false,
  "minimum_overtime_minutes" integer,
  "overtime_calculation_type" overtime_calculation_type_enum,
  "max_overtime_hours_monthly" integer,
  "late_penalty_type" penalty_type_enum DEFAULT 'none',
  "late_penalty_count_frequency" late_penalty_count_frequency_enum,
  "late_penalty_threshold" integer,
  "late_penalty_leave_type" leave_type_enum,
  "missing_swipe_policy" varchar(50),
  "auto_checkout_enabled" boolean DEFAULT false,
  "auto_checkout_time" time,
  "regularization_allowed" boolean DEFAULT true,
  "regularization_window_days" integer DEFAULT 7,
  "regularization_limit_monthly" integer DEFAULT 3,
  "weekend_overtime_multiplier" decimal(3,2) DEFAULT 2.00,
  "holiday_overtime_multiplier" decimal(3,2) DEFAULT 2.00,
  "status" status_enum DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  "created_by" uuid REFERENCES "employees"("employee_id"),
  "updated_by" uuid REFERENCES "employees"("employee_id"),
  CONSTRAINT "unique_org_attendance_settings" UNIQUE ("org_id")
);



-- Attendance Records Table
CREATE TABLE "attendance_records" (
  "record_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "employees"("employee_id") ON DELETE CASCADE,
  "attendance_date" date NOT NULL,
  "shift_type" shift_type_enum NOT NULL,
  "planned_start_time" timestamp,
  "planned_end_time" timestamp,
  "actual_start_time" timestamp,
  "actual_end_time" timestamp,
  "break_minutes" integer DEFAULT 0,
  "work_minutes" integer,
  "overtime_minutes" integer DEFAULT 0,
  "status" attendance_status_enum NOT NULL,
  "is_regularized" boolean DEFAULT false,
  "location_coordinates" point,
  "device_info" jsonb,
  "ip_address" varchar(45),
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "unique_employee_date" UNIQUE ("employee_id", "attendance_date")
);

-- Attendance Swipes Table
CREATE TABLE "attendance_swipes" (
  "swipe_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "record_id" uuid NOT NULL REFERENCES "attendance_records"("record_id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("employee_id") ON DELETE CASCADE,
  "swipe_time" timestamp NOT NULL,
  "swipe_type" varchar(10) CHECK (swipe_type IN ('in', 'out', 'break_start', 'break_end')),
  "capture_method" capture_method_enum NOT NULL,
  "location_coordinates" point,
  "device_info" jsonb,
  "ip_address" varchar(45),
  "is_valid" boolean DEFAULT true,
  "invalidation_reason" text,
  "created_at" timestamp DEFAULT (now())
);

-- Attendance Regularization Requests
CREATE TABLE "attendance_regularizations" (
  "regularization_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "record_id" uuid NOT NULL REFERENCES "attendance_records"("record_id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("employee_id") ON DELETE CASCADE,
  "regularization_type" varchar(20) CHECK (regularization_type IN ('missing_in', 'missing_out', 'both', 'correction')),
  "requested_start_time" timestamp,
  "requested_end_time" timestamp,
  "reason" text NOT NULL,
  "document_urls" text[],
  "status" regularization_status_enum NOT NULL DEFAULT 'pending',
  "approved_by" uuid REFERENCES "employees"("employee_id"),
  "approved_at" timestamp,
  "rejection_reason" text,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

-- Shift Configuration Table
CREATE TABLE "shift_configurations" (
  "shift_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("org_id") ON DELETE CASCADE,
  "shift_name" varchar(100) NOT NULL,
  "shift_type" shift_type_enum NOT NULL,
  "start_time" time,
  "end_time" time,
  "flexible_hours" integer,
  "break_duration" integer DEFAULT 60,
  "grace_period_minutes" integer DEFAULT 0,
  "half_day_hours" decimal(4,2),
  "full_day_hours" decimal(4,2),
  "description" text,
  "status" status_enum DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  "created_by" uuid REFERENCES "employees"("employee_id"),
  "updated_by" uuid REFERENCES "employees"("employee_id"),
  CONSTRAINT "unique_shift_name_org" UNIQUE ("org_id", "shift_name")
);

-- Employee Shift Assignments
CREATE TABLE "employee_shift_assignments" (
  "assignment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "employees"("employee_id") ON DELETE CASCADE,
  "shift_id" uuid NOT NULL REFERENCES "shift_configurations"("shift_id") ON DELETE CASCADE,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  "created_by" uuid REFERENCES "employees"("employee_id"),
  "updated_by" uuid REFERENCES "employees"("employee_id"),
  CONSTRAINT "no_overlapping_shifts" EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_from, effective_to, '[)') WITH &&
  )
);


-- Enhanced Payroll Cycles
CREATE TABLE "payroll_cycles" (
  "cycle_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("org_id") ON DELETE CASCADE,
  "cycle_name" varchar(100) NOT NULL,
  "start_day" integer NOT NULL CHECK (start_day BETWEEN 1 AND 31),
  "end_day" integer NOT NULL CHECK (end_day BETWEEN 1 AND 31),
  "processing_day" integer NOT NULL CHECK (processing_day BETWEEN 1 AND 31),
  "payment_day" integer NOT NULL CHECK (payment_day BETWEEN 1 AND 31),
  "consider_previous_month" boolean DEFAULT false,
  "is_default" boolean DEFAULT false,
  "status" status_enum DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "valid_cycle_days" CHECK (start_day < end_day)
);



-- Payroll Run Records
CREATE TABLE "payroll_runs" (
  "run_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("org_id") ON DELETE CASCADE,
  "cycle_id" uuid NOT NULL REFERENCES "payroll_cycles"("cycle_id"),
  "run_date" date NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "total_employees" integer NOT NULL DEFAULT 0,
  "total_gross" decimal(15,2) NOT NULL DEFAULT 0,
  "total_deductions" decimal(15,2) NOT NULL DEFAULT 0,
  "total_net_pay" decimal(15,2) NOT NULL DEFAULT 0,
  "status" payroll_status_enum NOT NULL DEFAULT 'draft',
  "locked" boolean DEFAULT false,
  "processed_by" uuid REFERENCES "employees"("employee_id"),
  "approved_by" uuid REFERENCES "employees"("employee_id"),
  "remarks" text,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

-- Employee Salary Payments
CREATE TABLE "employee_salary_payments" (
  "payment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "run_id" uuid NOT NULL REFERENCES "payroll_runs"("run_id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("employee_id"),
  "salary_id" uuid NOT NULL REFERENCES "employee_salaries"("salary_id"),
  "payment_date" date NOT NULL,
  "payment_mode" varchar(50) NOT NULL,
  "bank_account_id" uuid REFERENCES "employee_bank_details"("employee_bank_id"),
  "transaction_reference" varchar(100),
  "monthly_gross" decimal(15,2) NOT NULL,
  "total_earnings" decimal(15,2) NOT NULL,
  "total_deductions" decimal(15,2) NOT NULL,
  "net_pay" decimal(15,2) NOT NULL,
  "payment_status" varchar(50) DEFAULT 'pending',
  "remarks" text,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

-- Employee Salary Payment Components
CREATE TABLE "employee_payment_components" (
  "component_payment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "payment_id" uuid NOT NULL REFERENCES "employee_salary_payments"("payment_id") ON DELETE CASCADE,
  "component_id" uuid NOT NULL REFERENCES "salary_components_master"("component_id"),
  "amount" decimal(15,2) NOT NULL,
  "calculation_basis" varchar(50),
  "remarks" text,
  "created_at" timestamp DEFAULT (now()),
  CONSTRAINT "unique_component_per_payment" UNIQUE ("payment_id", "component_id")
);

-- Employee Salary Payment Adjustments
CREATE TABLE "salary_payment_adjustments" (
  "adjustment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "payment_id" uuid NOT NULL REFERENCES "employee_salary_payments"("payment_id") ON DELETE CASCADE,
  "adjustment_type" varchar(50) NOT NULL,
  "adjustment_reason" varchar(200) NOT NULL,
  "amount" decimal(15,2) NOT NULL,
  "reference_month" date,
  "approved_by" uuid REFERENCES "employees"("employee_id"),
  "remarks" text,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "org_configuration" (
  "config_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid,
  "capture_past_employees" boolean,
  "resignation_through_portal" boolean,
  "attendance_capture_method" varchar,
  "attendance_penalty_type" varchar,
  "regularization_frequency" varchar,
  "payroll_start_day" integer,
  "payroll_end_day" integer,
  "created_at" timestamp
);

CREATE TABLE "document_types" (
  "type_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "doc_type_name" document_type_enum NOT NULL,
  "description" text,
  "is_mandatory" boolean DEFAULT false,
  "validity_duration_months" integer,
  "created_at" timestamp DEFAULT (now())
);

CREATE TABLE "employee_documents" (
  "doc_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid,
  "doc_type_id" uuid,
  "document_number" varchar(100) NOT NULL,
  "document_url" text,
  "issue_date" date,
  "expiry_date" date,
  "issuing_authority" varchar(100),
  "verification_status" verification_status_enum DEFAULT 'pending',
  "verification_date" date,
  "verified_by" uuid,
  "verification_notes" text,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

-- Holiday Calendar Years - Defines the holiday calendar for each organization year
CREATE TABLE "holiday_calendar_years" (
  "calendar_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL,
  "year" integer NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status" status_enum NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "holiday_calendar_org_fk" FOREIGN KEY ("org_id") 
    REFERENCES "organizations" ("org_id") ON DELETE CASCADE,
  CONSTRAINT "unique_org_year" UNIQUE ("org_id", "year")
);

-- Holiday Master - Stores the base holiday definitions with their types and recurrence patterns
CREATE TABLE "holiday_master" (
  "holiday_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL,
  "holiday_name" varchar(100) NOT NULL,
  "holiday_type" holiday_type_enum NOT NULL,
  "recurrence_type" holiday_recurrence_enum NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "holiday_master_org_fk" FOREIGN KEY ("org_id") 
    REFERENCES "organizations" ("org_id") ON DELETE CASCADE,
  CONSTRAINT "unique_org_holiday_name" UNIQUE ("org_id", "holiday_name")
);

-- Holiday Calendar Details - Maps holidays to specific dates in a calendar year
CREATE TABLE "holiday_calendar_details" (
  "calendar_detail_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "calendar_id" uuid NOT NULL,
  "holiday_id" uuid NOT NULL,
  "holiday_date" date NOT NULL,
  "is_half_day" boolean DEFAULT false,
  "half_day_type" varchar(10) CHECK (half_day_type IN ('first_half', 'second_half')),
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "holiday_calendar_fk" FOREIGN KEY ("calendar_id") 
    REFERENCES "holiday_calendar_years" ("calendar_id") ON DELETE CASCADE,
  CONSTRAINT "holiday_master_fk" FOREIGN KEY ("holiday_id") 
    REFERENCES "holiday_master" ("holiday_id") ON DELETE CASCADE,
  CONSTRAINT "unique_calendar_date" UNIQUE ("calendar_id", "holiday_date")
);

-- Holiday Location Applicability - Maps holidays to specific organization locations
CREATE TABLE "holiday_location_applicability" (
  "applicability_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "calendar_detail_id" uuid NOT NULL,
  "location_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "holiday_location_calendar_fk" FOREIGN KEY ("calendar_detail_id") 
    REFERENCES "holiday_calendar_details" ("calendar_detail_id") ON DELETE CASCADE,
  CONSTRAINT "holiday_location_fk" FOREIGN KEY ("location_id") 
    REFERENCES "organization_locations" ("location_id") ON DELETE CASCADE,
  CONSTRAINT "unique_holiday_location" UNIQUE ("calendar_detail_id", "location_id")
);

-- Optional Holiday Employee Selection - Tracks which optional holidays employees have chosen
CREATE TABLE "optional_holiday_selection" (
  "selection_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "calendar_detail_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "status" status_enum NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now()),
  CONSTRAINT "optional_holiday_calendar_fk" FOREIGN KEY ("calendar_detail_id") 
    REFERENCES "holiday_calendar_details" ("calendar_detail_id") ON DELETE CASCADE,
  CONSTRAINT "optional_holiday_employee_fk" FOREIGN KEY ("employee_id") 
    REFERENCES "employees" ("employee_id") ON DELETE CASCADE,
  CONSTRAINT "unique_employee_holiday" UNIQUE ("calendar_detail_id", "employee_id")
);

-- Add Comments
COMMENT ON TABLE "policy_modules" IS 'Master table for all policy modules in the organization';
COMMENT ON TABLE "policy_settings" IS 'Configurable settings for each policy module';
COMMENT ON TABLE "probation_policies" IS 'Probation period policies for different employment types';
COMMENT ON TABLE "policy_document_versions" IS 'Version control for policy documents';
COMMENT ON TABLE "policy_acknowledgments" IS 'Employee acknowledgments for policy versions';
COMMENT ON TABLE "policy_location_applicability" IS 'Location-wise applicability of policies';
COMMENT ON TABLE "policy_department_applicability" IS 'Department-wise applicability of policies';
COMMENT ON TABLE "leave_policy_configurations" IS 'Leave policy configurations for different leave types';
-- Comments for the new tables
COMMENT ON TABLE "attendance_records" IS 'Daily attendance records for employees';
COMMENT ON TABLE "attendance_swipes" IS 'Individual attendance swipe records';
COMMENT ON TABLE "attendance_regularizations" IS 'Attendance regularization requests';
COMMENT ON TABLE "shift_configurations" IS 'Shift timing configurations';
COMMENT ON TABLE "employee_shift_assignments" IS 'Employee shift assignments with history';

-- Indexes for better query performance
CREATE INDEX "idx_attendance_records_date" ON "attendance_records"("attendance_date");
CREATE INDEX "idx_attendance_records_employee" ON "attendance_records"("employee_id");
CREATE INDEX "idx_attendance_swipes_record" ON "attendance_swipes"("record_id");
CREATE INDEX "idx_attendance_swipes_employee" ON "attendance_swipes"("employee_id");
CREATE INDEX "idx_regularizations_employee" ON "attendance_regularizations"("employee_id");
CREATE INDEX "idx_shift_assignments_employee" ON "employee_shift_assignments"("employee_id");


COMMENT ON TABLE "holiday_calendar_years" IS 'Defines yearly holiday calendars for each organization';
COMMENT ON COLUMN "holiday_calendar_years"."year" IS 'Calendar year for the holiday list';
COMMENT ON COLUMN "holiday_calendar_years"."start_date" IS 'Start date of the holiday calendar year';
COMMENT ON COLUMN "holiday_calendar_years"."end_date" IS 'End date of the holiday calendar year';

COMMENT ON TABLE "holiday_master" IS 'Master list of all holidays defined for an organization';
COMMENT ON COLUMN "holiday_master"."holiday_type" IS 'Type of holiday (public, religious, etc.)';
COMMENT ON COLUMN "holiday_master"."recurrence_type" IS 'How the holiday repeats (yearly fixed, yearly variable, one-time)';

COMMENT ON TABLE "holiday_calendar_details" IS 'Specific instances of holidays in a calendar year';
COMMENT ON COLUMN "holiday_calendar_details"."is_half_day" IS 'Whether this is a half-day holiday';
COMMENT ON COLUMN "holiday_calendar_details"."half_day_type" IS 'For half-day holidays, specifies which half of the day';

COMMENT ON TABLE "holiday_location_applicability" IS 'Maps holidays to specific organization locations';
COMMENT ON COLUMN "holiday_location_applicability"."location_id" IS 'The organization location where this holiday applies';

COMMENT ON TABLE "optional_holiday_selection" IS 'Tracks employee selections for optional holidays';
COMMENT ON COLUMN "optional_holiday_selection"."status" IS 'Status of the holiday selection (active/cancelled)';


-- CREATE UNIQUE INDEX ON "organization_holiday" ("org_id", "holiday_date");

-- Create indexes for organization_locations
CREATE INDEX "idx_org_locations_head_office" ON "organization_locations" ("org_id", "is_head_office");
CREATE INDEX "idx_org_locations_branch" ON "organization_locations" ("org_id", "is_branch");

-- Create indexes for employee_residential_addresses
CREATE INDEX "idx_emp_addresses_primary" ON "employee_residential_addresses" ("employee_id", "address_type", "is_primary");

COMMENT ON TABLE "organizations" IS 'Primary organization information table';

COMMENT ON COLUMN "organizations"."cin" IS 'Corporate Identity Number';

-- COMMENT ON COLUMN "organizations"."registered_office_location_id" IS 'References location_type=organization';

-- COMMENT ON TABLE "organization_holiday" IS 'Organization holiday calendar';

-- COMMENT ON COLUMN "organization_holiday"."holiday_type" IS 'public/restricted/optional';

-- COMMENT ON COLUMN "organization_holiday"."applicable_locations" IS 'Array of location_ids where holiday is applicable';

COMMENT ON COLUMN "organization_bank_details"."account_type" IS 'savings/current';

COMMENT ON COLUMN "organization_bank_details"."status" IS 'active/inactive';

COMMENT ON TABLE "organization_compliance_details" IS 'Organization statutory compliance details';

COMMENT ON COLUMN "organization_compliance_details"."pf_establishment_id" IS 'Provident Fund establishment ID';

COMMENT ON COLUMN "organization_compliance_details"."esi_number" IS 'Employee State Insurance number';

COMMENT ON COLUMN "organization_compliance_details"."pt_establishment_id" IS 'Professional Tax establishment ID';

COMMENT ON COLUMN "organization_compliance_details"."lwf_establishment_id" IS 'Labour Welfare Fund ID';

COMMENT ON TABLE "organization_locations" IS 'Organization locations and branches';
COMMENT ON TABLE "employee_residential_addresses" IS 'Employee residential addresses';
COMMENT ON COLUMN "organization_locations"."timezone" IS 'IANA timezone format';
COMMENT ON COLUMN "employee_residential_addresses"."address_type" IS 'permanent/current';

-- COMMENT ON COLUMN "locations"."employee_id" IS 'Required for employee-associated locations';

-- COMMENT ON COLUMN "locations"."timezone" IS 'IANA timezone format';

-- COMMENT ON COLUMN "locations"."is_head_office" IS 'For organization locations';

-- COMMENT ON COLUMN "locations"."is_primary" IS 'For employee locations';

COMMENT ON COLUMN "country_master"."country_code" IS 'ISO 3166-1 alpha-3 code';

COMMENT ON COLUMN "country_master"."dial_code" IS 'International dialing code with +';

COMMENT ON COLUMN "country_master"."currency_code" IS 'ISO 4217 currency code';

COMMENT ON TABLE "state_master" IS 'Master table for state/province information';

COMMENT ON TABLE "department_types" IS 'Master table for department types';

COMMENT ON TABLE "departments" IS 'Department structure and hierarchy';

COMMENT ON COLUMN "departments"."parent_dept_id" IS 'Self-referential for hierarchy';

COMMENT ON TABLE "employees" IS 'Core employee information table';

COMMENT ON COLUMN "employees"."work_location_id" IS 'References location_type=employee_work';

-- COMMENT ON COLUMN "employees"."residence_location_id" IS 'References location_type=employee_residence';

COMMENT ON COLUMN "employees"."title" IS 'Mr./Ms./Dr./etc.';

COMMENT ON COLUMN "employees"."gender" IS 'male/female/other';

COMMENT ON COLUMN "employees"."status" IS 'active/inactive/on_notice/terminated';

COMMENT ON COLUMN "employment_types"."type_name" IS 'permanent/contract/intern/consultant';

COMMENT ON TABLE "employee_personal_details" IS 'Extended personal information of employees';

COMMENT ON COLUMN "employee_personal_details"."social_media_handles" IS 'JSON containing social media profile links';

COMMENT ON TABLE "bank_master" IS 'Master table for bank information';

-- COMMENT ON COLUMN "bank_master"."org_id" IS 'Required for organizations bank';

-- COMMENT ON COLUMN "bank_master"."employee_id" IS 'Required for employees bank';

COMMENT ON COLUMN "bank_master"."bank_code" IS 'Official bank code';

COMMENT ON COLUMN "bank_master"."swift_code" IS 'International SWIFT/BIC code';

COMMENT ON COLUMN "employee_bank_details"."account_type" IS 'savings/current';

COMMENT ON COLUMN "employee_bank_details"."status" IS 'active/inactive';

COMMENT ON COLUMN "attendance_settings"."capture_method" IS 'biometric/mobile_app/web_app';

COMMENT ON COLUMN "attendance_settings"."geo_fencing_enabled" IS 'Enable location-based attendance';

COMMENT ON COLUMN "attendance_settings"."geo_fence_radius" IS 'Radius in meters for geo-fencing';

COMMENT ON COLUMN "attendance_settings"."shift_type" IS 'fixed/flexible/rotational';

-- COMMENT ON COLUMN "attendance_settings"."work_hours_per_day" IS 'Standard work hours required per day';

COMMENT ON COLUMN "attendance_settings"."work_days_per_week" IS 'Number of working days in a week';

COMMENT ON COLUMN "attendance_settings"."grace_period_minutes" IS 'Grace period for late entry';

COMMENT ON COLUMN "attendance_settings"."half_day_hours" IS 'Minimum hours for half day consideration';

COMMENT ON COLUMN "attendance_settings"."minimum_overtime_minutes" IS 'Minimum minutes to be considered as overtime';

COMMENT ON COLUMN "attendance_settings"."overtime_calculation_type" IS 'daily/weekly/monthly';

COMMENT ON COLUMN "attendance_settings"."max_overtime_hours_monthly" IS 'Maximum allowed overtime hours per month';

COMMENT ON COLUMN "attendance_settings"."late_penalty_type" IS 'none/leave_deduction/salary_deduction';

COMMENT ON COLUMN "attendance_settings"."late_penalty_count_frequency" IS 'daily/weekly/monthly';

COMMENT ON COLUMN "attendance_settings"."late_penalty_threshold" IS 'Number of late marks before penalty';

COMMENT ON COLUMN "attendance_settings"."late_penalty_leave_type" IS 'paid_leave/unpaid_leave';

COMMENT ON COLUMN "attendance_settings"."missing_swipe_policy" IS 'Policy for handling missing in/out swipes';

COMMENT ON COLUMN "attendance_settings"."auto_checkout_time" IS 'Time for automatic checkout if enabled';

COMMENT ON COLUMN "attendance_settings"."regularization_limit_monthly" IS 'Maximum allowed regularizations per month';

COMMENT ON COLUMN "attendance_settings"."regularization_window_days" IS 'Days allowed for backdated regularization';

COMMENT ON COLUMN "attendance_settings"."weekend_overtime_multiplier" IS 'Overtime multiplier for weekend work';

COMMENT ON COLUMN "attendance_settings"."holiday_overtime_multiplier" IS 'Overtime multiplier for holiday work';

COMMENT ON TABLE "document_types" IS 'Master table for document types';

COMMENT ON COLUMN "document_types"."validity_duration_months" IS 'Number of months document is valid for';

COMMENT ON TABLE "employee_documents" IS 'Employee document records and verification status';

COMMENT ON COLUMN "employee_documents"."document_url" IS 'S3 or storage URL';

-- ALTER TABLE "organizations" ADD FOREIGN KEY ("registered_office_location_id") REFERENCES "locations" ("location_id");

-- ALTER TABLE "organization_holiday" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "organization_bank_details" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "organization_bank_details" ADD FOREIGN KEY ("bank_id") REFERENCES "bank_master" ("bank_id");

ALTER TABLE "organization_compliance_details" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

-- ALTER TABLE "locations" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

-- ALTER TABLE "locations" ADD FOREIGN KEY ("employee_id") REFERENCES "employees" ("employee_id");

-- ALTER TABLE "locations" ADD FOREIGN KEY ("country_id") REFERENCES "country_master" ("country_id");

-- ALTER TABLE "locations" ADD FOREIGN KEY ("state_id") REFERENCES "state_master" ("state_id");

ALTER TABLE "state_master" ADD FOREIGN KEY ("country_id") REFERENCES "country_master" ("country_id");

ALTER TABLE "departments" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "departments" ADD FOREIGN KEY ("dept_type_id") REFERENCES "department_types" ("dept_type_id");

ALTER TABLE "departments" ADD FOREIGN KEY ("parent_dept_id") REFERENCES "departments" ("dept_id");

ALTER TABLE "employees" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "employees" ADD FOREIGN KEY ("employment_type_id") REFERENCES "employment_types" ("employment_type_id");

ALTER TABLE "employees" ADD FOREIGN KEY ("dept_id") REFERENCES "departments" ("dept_id");

-- ALTER TABLE "employees" ADD FOREIGN KEY ("work_location_id") REFERENCES "locations" ("location_id");

-- ALTER TABLE "employees" ADD FOREIGN KEY ("residence_location_id") REFERENCES "locations" ("location_id");

ALTER TABLE "employees" ADD FOREIGN KEY ("reporting_manager_id") REFERENCES "employees" ("employee_id");

ALTER TABLE "job_titles" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "employee_personal_details" ADD FOREIGN KEY ("employee_id") REFERENCES "employees" ("employee_id");
ALTER TABLE "employees" ADD FOREIGN KEY ("job_title_id") REFERENCES "job_titles" ("job_title_id");
-- ALTER TABLE "bank_master" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

-- ALTER TABLE "bank_master" ADD FOREIGN KEY ("employee_id") REFERENCES "employees" ("employee_id");

ALTER TABLE "employee_bank_details" ADD FOREIGN KEY ("bank_id") REFERENCES "bank_master" ("bank_id");

ALTER TABLE "attendance_settings" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "attendance_settings" ADD FOREIGN KEY ("created_by") REFERENCES "employees" ("employee_id");

ALTER TABLE "attendance_settings" ADD FOREIGN KEY ("updated_by") REFERENCES "employees" ("employee_id");

ALTER TABLE "employee_documents" ADD FOREIGN KEY ("employee_id") REFERENCES "employees" ("employee_id");

ALTER TABLE "employee_documents" ADD FOREIGN KEY ("doc_type_id") REFERENCES "document_types" ("type_id");

ALTER TABLE "employee_documents" ADD FOREIGN KEY ("verified_by") REFERENCES "employees" ("employee_id");

ALTER TABLE "policy_modules" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "policy_settings" ADD FOREIGN KEY ("module_id") REFERENCES "policy_modules" ("module_id");

ALTER TABLE "policy_settings" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "probation_policies" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

-- ALTER TABLE "leave_policies" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "payroll_cycles" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "salary_components_master" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

-- ALTER TABLE "employee_previous_salaries" ADD FOREIGN KEY ("employee_id") REFERENCES "employees" ("employee_id");

ALTER TABLE "org_configuration" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "organization_tax_details" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "salary_structures" ADD FOREIGN KEY ("org_id") REFERENCES "organizations" ("org_id");

ALTER TABLE "employee_financial_details" ADD FOREIGN KEY ("compliance_id") REFERENCES "organization_compliance_details" ("org_compliance_id");

ALTER TABLE "employee_financial_details" ADD FOREIGN KEY ("employee_id") REFERENCES "employees" ("employee_id");

ALTER TABLE "employee_financial_details" ADD FOREIGN KEY ("employee_bank_id") REFERENCES "employee_bank_details" ("employee_bank_id");

ALTER TABLE "employee_salaries" ADD FOREIGN KEY ("employee_id") REFERENCES "employees" ("employee_id");

-- ALTER TABLE "salary_components" ADD FOREIGN KEY ("structure_id") REFERENCES "salary_structures" ("structure_id");

ALTER TABLE "employee_salaries" ADD FOREIGN KEY ("structure_id") REFERENCES "salary_structures" ("structure_id");

ALTER TABLE "attendance_settings" ADD CONSTRAINT "unique_setting_id" UNIQUE ("setting_id");
