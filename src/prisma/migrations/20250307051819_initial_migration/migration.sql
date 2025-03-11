-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('aadhar', 'pan', 'passport', 'driving_license', 'voter_id', 'bank_statement', 'salary_slip', 'experience_letter', 'education_certificate', 'other');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('savings', 'current', 'salary');

-- CreateEnum
CREATE TYPE "CalculationType" AS ENUM ('fixed', 'percentage', 'formula', 'hourly', 'daily', 'per_unit');

-- CreateEnum
CREATE TYPE "EmploymentTypeEnum" AS ENUM ('permanent', 'contract', 'intern', 'consultant', 'probation');

-- CreateEnum
CREATE TYPE "SalaryPaymentMode" AS ENUM ('bank_transfer', 'cash', 'cheque', 'other');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('sick', 'casual', 'earned', 'maternity', 'paternity', 'unpaid', 'compensatory');

-- CreateEnum
CREATE TYPE "CaptureMethodEnum" AS ENUM ('web_app', 'mobile_app', 'biometric', 'card_reader');

-- CreateEnum
CREATE TYPE "ShiftTypeEnum" AS ENUM ('fixed', 'flexible', 'rotational');

-- CreateEnum
CREATE TYPE "OvertimeCalculationTypeEnum" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "PenaltyTypeEnum" AS ENUM ('none', 'leave_deduction', 'salary_deduction', 'warning');

-- CreateEnum
CREATE TYPE "LatePenaltyCountFrequencyEnum" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "AttendanceStatusEnum" AS ENUM ('present', 'absent', 'half_day', 'on_leave', 'holiday', 'weekend');

-- CreateEnum
CREATE TYPE "RegularizationStatusEnum" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('active', 'inactive', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('active', 'inactive', 'on_notice', 'terminated', 'suspended');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('single', 'married', 'divorced', 'widowed');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('permanent', 'current');

-- CreateEnum
CREATE TYPE "BankType" AS ENUM ('organization_bank', 'employee_bank');

-- CreateEnum
CREATE TYPE "CaptureMethod" AS ENUM ('biometric', 'mobile_app', 'web_app');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('fixed', 'flexible', 'rotational');

-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('none', 'leave_deduction', 'salary_deduction');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "HalfDayType" AS ENUM ('first_half', 'second_half', 'forenoon', 'afternoon');

-- CreateEnum
CREATE TYPE "AcknowledgementType" AS ENUM ('electronic', 'physical', 'verbal', 'other');

-- CreateEnum
CREATE TYPE "OvertimeCalculationType" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'withdrawn');

-- CreateEnum
CREATE TYPE "LeaveAccrualFrequency" AS ENUM ('monthly', 'quarterly', 'yearly', 'anniversary');

-- CreateEnum
CREATE TYPE "LeaveBalanceUpdateType" AS ENUM ('accrual', 'adjustment', 'expiry', 'carry_forward', 'leave_taken');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent', 'half_day', 'on_leave', 'holiday', 'weekend', 'work_from_home');

-- CreateEnum
CREATE TYPE "RegularizationStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "SettingType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'TIME', 'DATETIME', 'JSON', 'ARRAY', 'SELECT', 'MULTISELECT', 'TEXTAREA', 'PASSWORD');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('public', 'religious', 'regional', 'company_specific', 'optional');

-- CreateEnum
CREATE TYPE "HolidayRecurrence" AS ENUM ('yearly_fixed_date', 'yearly_variable_date', 'one_time');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('draft', 'processing', 'review_pending', 'approved', 'rejected', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "LatePenaltyCountFrequency" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "PolicyCategory" AS ENUM ('employment', 'leave', 'attendance', 'payroll', 'benefits', 'compliance', 'performance', 'training', 'it_security', 'general');

-- CreateEnum
CREATE TYPE "ComponentCategory" AS ENUM ('earnings', 'deductions', 'benefits', 'reimbursements');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('fixed', 'variable', 'adhoc');

-- CreateEnum
CREATE TYPE "CalculationFrequency" AS ENUM ('monthly', 'quarterly', 'annual', 'one_time');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('draft', 'under_review', 'active', 'inactive', 'archived', 'deprecated');

-- CreateTable
CREATE TABLE "bank_master" (
    "bank_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bank_type" "BankType" NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "bank_code" VARCHAR(20) NOT NULL,
    "swift_code" VARCHAR(11),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_master_pkey" PRIMARY KEY ("bank_id")
);

-- CreateTable
CREATE TABLE "country_master" (
    "country_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "country_code" VARCHAR(3) NOT NULL,
    "country_name" VARCHAR(100) NOT NULL,
    "dial_code" VARCHAR(5) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "country_master_pkey" PRIMARY KEY ("country_id")
);

-- CreateTable
CREATE TABLE "state_master" (
    "state_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "country_id" UUID NOT NULL,
    "state_code" VARCHAR(10) NOT NULL,
    "state_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "state_master_pkey" PRIMARY KEY ("state_id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "org_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "legal_entity_name" VARCHAR(255) NOT NULL,
    "auth_signatory_name" VARCHAR(255) NOT NULL,
    "auth_signatory_designation" VARCHAR(255) NOT NULL,
    "auth_signatory_email" VARCHAR(255) NOT NULL,
    "auth_signatory_father_name" VARCHAR(255),
    "corporation_date" DATE NOT NULL,
    "cin" VARCHAR(21) NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("org_id")
);

-- CreateTable
CREATE TABLE "organization_locations" (
    "location_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "location_name" VARCHAR(100) NOT NULL,
    "location_code" VARCHAR(50) NOT NULL,
    "is_head_office" BOOLEAN NOT NULL DEFAULT false,
    "is_registered_office" BOOLEAN NOT NULL DEFAULT false,
    "is_branch" BOOLEAN NOT NULL DEFAULT true,
    "address_line1" VARCHAR(255) NOT NULL,
    "address_line2" VARCHAR(255),
    "locality" VARCHAR(100),
    "city" VARCHAR(100) NOT NULL,
    "country_id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "pincode" VARCHAR(10) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "gstin" VARCHAR(15),
    "timezone" VARCHAR(50) NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_locations_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "organization_bank_details" (
    "org_bank_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "bank_id" UUID NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_type" "AccountType" DEFAULT 'current',
    "ifsc_code" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "name_on_account" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_bank_details_pkey" PRIMARY KEY ("org_bank_id")
);

-- CreateTable
CREATE TABLE "organization_tax_details" (
    "org_tax_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "pan" TEXT,
    "tan" TEXT,
    "tan_circle_number" TEXT,
    "corporate_income_tax_location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_tax_details_pkey" PRIMARY KEY ("org_tax_id")
);

-- CreateTable
CREATE TABLE "organization_compliance_details" (
    "org_compliance_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "compliance_code" VARCHAR(3) NOT NULL,
    "pf_establishment_id" VARCHAR(50),
    "pf_number" VARCHAR(50) NOT NULL,
    "pf_registration_date" DATE NOT NULL,
    "esi_number" VARCHAR(50),
    "esi_registration_date" DATE,
    "pt_establishment_id" VARCHAR(50),
    "pt_number" VARCHAR(50),
    "pt_registration_date" DATE,
    "lwf_establishment_id" VARCHAR(50),
    "lwf_registration_date" DATE,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_compliance_details_pkey" PRIMARY KEY ("org_compliance_id")
);

-- CreateTable
CREATE TABLE "department_types" (
    "dept_type_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type_name" VARCHAR(50) NOT NULL,
    "type_code" VARCHAR(5) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_types_pkey" PRIMARY KEY ("dept_type_id")
);

-- CreateTable
CREATE TABLE "departments" (
    "dept_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "dept_type_id" UUID,
    "dept_code" VARCHAR(20) NOT NULL,
    "dept_name" VARCHAR(100) NOT NULL,
    "parent_dept_id" UUID,
    "cost_center_code" VARCHAR(5),
    "description" TEXT,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("dept_id")
);

-- CreateTable
CREATE TABLE "employment_types" (
    "employment_type_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type_name" "EmploymentTypeEnum" NOT NULL DEFAULT 'permanent',
    "type_code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_types_pkey" PRIMARY KEY ("employment_type_id")
);

-- CreateTable
CREATE TABLE "job_titles" (
    "job_title_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "title_name" VARCHAR NOT NULL,
    "title_code" VARCHAR(50) NOT NULL,
    "title_description" TEXT,
    "grade_level" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_titles_pkey" PRIMARY KEY ("job_title_id")
);

-- CreateTable
CREATE TABLE "employees" (
    "employee_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "employee_number" VARCHAR(50) NOT NULL,
    "employment_type_id" UUID,
    "dept_id" UUID,
    "work_location_id" UUID,
    "job_title_id" UUID,
    "title" VARCHAR(10),
    "first_name" VARCHAR(50) NOT NULL,
    "middle_name" VARCHAR(50),
    "last_name" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "official_email" VARCHAR(255),
    "personal_email" VARCHAR(255),
    "mobile_number" VARCHAR(15) NOT NULL,
    "emergency_contact_name" VARCHAR(100),
    "emergency_contact_relationship" VARCHAR(50),
    "emergency_contact_number" VARCHAR(15),
    "date_joined" DATE NOT NULL,
    "probation_end_date" DATE,
    "confirmation_date" DATE,
    "contract_end_date" DATE,
    "reporting_manager_id" UUID,
    "notice_period_days" INTEGER NOT NULL DEFAULT 0,
    "status" "EmploymentStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "employee_personal_details" (
    "empl_personal_det_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "marital_status" "MaritalStatus",
    "marriage_date" DATE,
    "blood_group" VARCHAR(5),
    "nationality" VARCHAR(50) NOT NULL,
    "physically_challenged" BOOLEAN NOT NULL DEFAULT false,
    "disability_details" TEXT,
    "father_name" VARCHAR(100) NOT NULL,
    "mother_name" VARCHAR(100) NOT NULL,
    "spouse_name" VARCHAR(100),
    "spouse_gender" "Gender",
    "residence_number" VARCHAR(15),
    "social_media_handles" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_personal_details_pkey" PRIMARY KEY ("empl_personal_det_id")
);

-- CreateTable
CREATE TABLE "employee_bank_details" (
    "employee_bank_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "bank_id" UUID NOT NULL,
    "account_number" VARCHAR NOT NULL,
    "account_type" "AccountType" DEFAULT 'salary',
    "ifsc_code" VARCHAR NOT NULL,
    "branch_name" VARCHAR NOT NULL,
    "name_on_account" VARCHAR NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_bank_details_pkey" PRIMARY KEY ("employee_bank_id")
);

-- CreateTable
CREATE TABLE "employee_financial_details" (
    "empl_financial_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "compliance_id" UUID,
    "employee_bank_id" UUID,
    "salary_payment_mode" "SalaryPaymentMode" DEFAULT 'bank_transfer',
    "pf_details_available" BOOLEAN,
    "pf_number" TEXT,
    "pf_joining_date" DATE,
    "employee_contribution_to_pf" TEXT,
    "uan" TEXT,
    "esi_details_available" BOOLEAN,
    "esi_eligible" BOOLEAN,
    "employer_esi_number" TEXT,
    "lwf_eligible" BOOLEAN,
    "aadhar_number" TEXT,
    "dob_in_aadhar" DATE,
    "full_name_in_aadhar" VARCHAR,
    "gender_in_aadhar" VARCHAR,
    "pan_available" BOOLEAN,
    "pan_number" TEXT,
    "full_name_in_pan" VARCHAR,
    "dob_in_pan" VARCHAR,
    "parents_name_in_pan" VARCHAR,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_financial_details_pkey" PRIMARY KEY ("empl_financial_id")
);

-- CreateTable
CREATE TABLE "employee_residential_addresses" (
    "address_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "address_type" "AddressType" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "country_id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" VARCHAR(100) NOT NULL,
    "zip" VARCHAR(10) NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_residential_addresses_pkey" PRIMARY KEY ("address_id")
);

-- CreateTable
CREATE TABLE "salary_components_master" (
    "component_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "component_name" VARCHAR(100) NOT NULL,
    "component_code" VARCHAR(20) NOT NULL,
    "component_category" "ComponentCategory" NOT NULL,
    "component_type" "ComponentType" NOT NULL,
    "calculation_type" "CalculationType" NOT NULL DEFAULT 'fixed',
    "calculation_basis" VARCHAR(50),
    "calculation_formula" TEXT,
    "calculation_frequency" "CalculationFrequency" DEFAULT 'monthly',
    "is_taxable" BOOLEAN NOT NULL DEFAULT false,
    "consider_for_ctc" BOOLEAN NOT NULL DEFAULT true,
    "consider_for_esi" BOOLEAN NOT NULL DEFAULT false,
    "consider_for_pf" BOOLEAN NOT NULL DEFAULT false,
    "consider_for_bonus" BOOLEAN NOT NULL DEFAULT false,
    "min_value" DECIMAL(15,2),
    "max_value" DECIMAL(15,2),
    "rounding_factor" INTEGER NOT NULL DEFAULT 0,
    "print_name" VARCHAR(100),
    "description" TEXT,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_components_master_pkey" PRIMARY KEY ("component_id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "structure_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "structure_name" VARCHAR(100) NOT NULL,
    "structure_code" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "min_ctc" DECIMAL(15,2),
    "max_ctc" DECIMAL(15,2),
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("structure_id")
);

-- CreateTable
CREATE TABLE "salary_structure_components" (
    "structure_component_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "structure_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "calculation_priority" INTEGER NOT NULL DEFAULT 0,
    "percentage_of_basic" DECIMAL(5,2),
    "percentage_of_ctc" DECIMAL(5,2),
    "min_value" DECIMAL(15,2),
    "max_value" DECIMAL(15,2),
    "default_value" DECIMAL(15,2),
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_structure_components_pkey" PRIMARY KEY ("structure_component_id")
);

-- CreateTable
CREATE TABLE "employee_salaries" (
    "salary_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "structure_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "annual_ctc" DECIMAL(15,2) NOT NULL,
    "monthly_ctc" DECIMAL(15,2) NOT NULL,
    "basic_percent" DECIMAL(5,2) NOT NULL,
    "hra_percent" DECIMAL(5,2),
    "revision_type" VARCHAR(50),
    "revision_reason" TEXT,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_salaries_pkey" PRIMARY KEY ("salary_id")
);

-- CreateTable
CREATE TABLE "payroll_cycles" (
    "cycle_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "cycle_name" VARCHAR(100) NOT NULL,
    "start_day" INTEGER NOT NULL,
    "end_day" INTEGER NOT NULL,
    "processing_day" INTEGER NOT NULL,
    "payment_day" INTEGER NOT NULL,
    "consider_previous_month" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_cycles_pkey" PRIMARY KEY ("cycle_id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "run_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "run_date" DATE NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "total_employees" INTEGER NOT NULL DEFAULT 0,
    "total_gross" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_net_pay" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" "PayrollStatus" NOT NULL DEFAULT 'draft',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "processed_by" UUID,
    "approved_by" UUID,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("run_id")
);

-- CreateTable
CREATE TABLE "employee_salary_payments" (
    "payment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "salary_id" UUID NOT NULL,
    "payment_date" DATE NOT NULL,
    "payment_mode" VARCHAR(50) NOT NULL,
    "bank_account_id" UUID,
    "transaction_reference" VARCHAR(100),
    "monthly_gross" DECIMAL(15,2) NOT NULL,
    "total_earnings" DECIMAL(15,2) NOT NULL,
    "total_deductions" DECIMAL(15,2) NOT NULL,
    "net_pay" DECIMAL(15,2) NOT NULL,
    "payment_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_salary_payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "salary_payment_adjustments" (
    "adjustment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "adjustment_type" VARCHAR(50) NOT NULL,
    "adjustment_reason" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "reference_month" DATE,
    "approved_by" UUID,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_payment_adjustments_pkey" PRIMARY KEY ("adjustment_id")
);

-- CreateTable
CREATE TABLE "employee_payment_components" (
    "component_payment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "calculation_basis" VARCHAR(50),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_payment_components_pkey" PRIMARY KEY ("component_payment_id")
);

-- CreateTable
CREATE TABLE "policy_modules" (
    "module_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "module_name" VARCHAR(100) NOT NULL,
    "module_code" VARCHAR(50) NOT NULL,
    "module_category" "PolicyCategory" NOT NULL,
    "module_description" TEXT,
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "status" "PolicyStatus" NOT NULL DEFAULT 'draft',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "policy_modules_pkey" PRIMARY KEY ("module_id")
);

-- CreateTable
CREATE TABLE "policy_settings" (
    "setting_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "setting_name" VARCHAR(100) NOT NULL,
    "setting_key" VARCHAR(50) NOT NULL,
    "setting_value" JSONB NOT NULL,
    "setting_type" "SettingType" NOT NULL DEFAULT 'NUMBER',
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "is_configurable" BOOLEAN NOT NULL DEFAULT true,
    "validation_rules" JSONB,
    "default_value" JSONB,
    "description" TEXT,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "policy_settings_pkey" PRIMARY KEY ("setting_id")
);

-- CreateTable
CREATE TABLE "probation_policies" (
    "policy_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "employment_type_id" UUID,
    "employee_id" UUID,
    "dept_id" UUID,
    "probation_code" VARCHAR(50) NOT NULL,
    "probation_period_months" INTEGER NOT NULL,
    "min_extension_months" INTEGER NOT NULL DEFAULT 1,
    "max_extension_months" INTEGER,
    "extension_allowed" BOOLEAN NOT NULL DEFAULT true,
    "max_extensions" INTEGER NOT NULL DEFAULT 1,
    "auto_confirm" BOOLEAN NOT NULL DEFAULT false,
    "notice_period_days" INTEGER NOT NULL DEFAULT 30,
    "review_required" BOOLEAN NOT NULL DEFAULT true,
    "review_before_days" INTEGER NOT NULL DEFAULT 15,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "probation_policies_pkey" PRIMARY KEY ("policy_id")
);

-- CreateTable
CREATE TABLE "policy_document_versions" (
    "version_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "version_number" VARCHAR(20) NOT NULL,
    "document_url" TEXT,
    "change_summary" TEXT,
    "status" "PolicyStatus" NOT NULL DEFAULT 'draft',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "approved_at" TIMESTAMP(3),
    "approved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "policy_document_versions_pkey" PRIMARY KEY ("version_id")
);

-- CreateTable
CREATE TABLE "policy_acknowledgments" (
    "acknowledgment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgment_type" "AcknowledgementType" NOT NULL DEFAULT 'electronic',
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "comments" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_acknowledgments_pkey" PRIMARY KEY ("acknowledgment_id")
);

-- CreateTable
CREATE TABLE "policy_location_applicability" (
    "applicability_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "policy_location_applicability_pkey" PRIMARY KEY ("applicability_id")
);

-- CreateTable
CREATE TABLE "policy_department_applicability" (
    "applicability_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "dept_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "policy_department_applicability_pkey" PRIMARY KEY ("applicability_id")
);

-- CreateTable
CREATE TABLE "leave_policy_configurations" (
    "config_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "accrual_frequency" "LeaveAccrualFrequency" NOT NULL,
    "days_per_year" DECIMAL(5,2) NOT NULL,
    "min_days_per_request" INTEGER,
    "max_days_per_request" INTEGER,
    "min_notice_days" INTEGER NOT NULL DEFAULT 0,
    "max_carry_forward_days" INTEGER NOT NULL DEFAULT 0,
    "carry_forward_validity_months" INTEGER NOT NULL DEFAULT 12,
    "is_encashable" BOOLEAN NOT NULL DEFAULT false,
    "encashment_limit" INTEGER,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "requires_documents" BOOLEAN NOT NULL DEFAULT false,
    "document_submission_days" INTEGER,
    "applicable_from_months" INTEGER NOT NULL DEFAULT 0,
    "prorata_basis" BOOLEAN NOT NULL DEFAULT true,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "leave_policy_configurations_pkey" PRIMARY KEY ("config_id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "balance_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "year" INTEGER NOT NULL,
    "total_entitled" DECIMAL(5,2) NOT NULL,
    "carried_forward" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "accrued" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "used" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pending" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "available" DECIMAL(5,2) NOT NULL,
    "carried_forward_expiry" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("balance_id")
);

-- CreateTable
CREATE TABLE "leave_balance_history" (
    "history_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "balance_id" UUID NOT NULL,
    "update_type" "LeaveBalanceUpdateType" NOT NULL,
    "amount" DECIMAL(5,2) NOT NULL,
    "reference_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "leave_balance_history_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "request_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "leave_type" "LeaveType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "duration_days" DECIMAL(5,2) NOT NULL,
    "first_day_half" BOOLEAN NOT NULL DEFAULT false,
    "last_day_half" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "contact_details" JSONB,
    "document_urls" TEXT[],
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'pending',
    "cancellation_reason" TEXT,
    "rejection_reason" TEXT,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "leave_request_workflow" (
    "workflow_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "approval_order" INTEGER NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'pending',
    "comments" TEXT,
    "acted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_request_workflow_pkey" PRIMARY KEY ("workflow_id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "check_in" TIMESTAMP(3),
    "check_out" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "capture_method" "CaptureMethod"[] DEFAULT ARRAY['web_app']::"CaptureMethod"[],
    "geo_fencing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "geo_fence_radius" INTEGER,
    "shift_type" "ShiftType" NOT NULL DEFAULT 'fixed',
    "shift_start_time" TIME,
    "shift_end_time" TIME,
    "flexible_hours" INTEGER,
    "grace_period_minutes" INTEGER NOT NULL DEFAULT 0,
    "half_day_hours" INTEGER,
    "full_day_hours" DECIMAL(4,2),
    "break_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "work_days_per_week" INTEGER NOT NULL DEFAULT 5,
    "overtime_policy_enabled" BOOLEAN NOT NULL DEFAULT false,
    "minimum_overtime_minutes" INTEGER,
    "overtime_calculation_type" "OvertimeCalculationType",
    "max_overtime_hours_monthly" INTEGER,
    "late_penalty_type" "PenaltyType" NOT NULL DEFAULT 'none',
    "late_penalty_leave_type" "LeaveType",
    "missing_swipe_policy" VARCHAR(50),
    "auto_checkout_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_checkout_time" TIME,
    "regularization_allowed" BOOLEAN NOT NULL DEFAULT true,
    "regularization_window_days" INTEGER NOT NULL DEFAULT 7,
    "regularization_limit_monthly" INTEGER NOT NULL DEFAULT 3,
    "weekend_overtime_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 2.00,
    "holiday_overtime_multiplier" DECIMAL(3,2) NOT NULL DEFAULT 2.00,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "record_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "attendance_date" DATE NOT NULL,
    "shift_type" "ShiftTypeEnum" NOT NULL,
    "planned_start_time" TIMESTAMP(3),
    "planned_end_time" TIMESTAMP(3),
    "actual_start_time" TIMESTAMP(3),
    "actual_end_time" TIMESTAMP(3),
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "work_minutes" INTEGER,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceStatusEnum" NOT NULL,
    "is_regularized" BOOLEAN NOT NULL DEFAULT false,
    "location_coordinates" JSONB,
    "device_info" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("record_id")
);

-- CreateTable
CREATE TABLE "attendance_swipes" (
    "swipe_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "record_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "swipe_time" TIMESTAMP(3) NOT NULL,
    "swipe_type" VARCHAR(10) NOT NULL,
    "capture_method" "CaptureMethodEnum" NOT NULL,
    "location_coordinates" JSONB,
    "device_info" JSONB,
    "ip_address" VARCHAR(45),
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "invalidation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_swipes_pkey" PRIMARY KEY ("swipe_id")
);

-- CreateTable
CREATE TABLE "attendance_regularizations" (
    "regularization_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "record_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "regularization_type" VARCHAR(20) NOT NULL,
    "requested_start_time" TIMESTAMP(3),
    "requested_end_time" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "document_urls" TEXT[],
    "status" "RegularizationStatusEnum" NOT NULL DEFAULT 'pending',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_regularizations_pkey" PRIMARY KEY ("regularization_id")
);

-- CreateTable
CREATE TABLE "shift_configurations" (
    "shift_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "shift_name" VARCHAR(100) NOT NULL,
    "shift_type" "ShiftTypeEnum" NOT NULL,
    "start_time" TIME,
    "end_time" TIME,
    "flexible_hours" INTEGER,
    "break_duration" INTEGER NOT NULL DEFAULT 60,
    "grace_period_minutes" INTEGER NOT NULL DEFAULT 0,
    "half_day_hours" DECIMAL(4,2),
    "full_day_hours" DECIMAL(4,2),
    "description" TEXT,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "shift_configurations_pkey" PRIMARY KEY ("shift_id")
);

-- CreateTable
CREATE TABLE "employee_shift_assignments" (
    "assignment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "employee_shift_assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "holiday_calendar_years" (
    "calendar_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_calendar_years_pkey" PRIMARY KEY ("calendar_id")
);

-- CreateTable
CREATE TABLE "holiday_master" (
    "holiday_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "holiday_name" VARCHAR(100) NOT NULL,
    "holiday_type" "HolidayType" NOT NULL,
    "recurrence_type" "HolidayRecurrence" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_master_pkey" PRIMARY KEY ("holiday_id")
);

-- CreateTable
CREATE TABLE "holiday_calendar_details" (
    "calendar_detail_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calendar_id" UUID NOT NULL,
    "holiday_id" UUID NOT NULL,
    "holiday_date" DATE NOT NULL,
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "half_day_type" "HalfDayType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_calendar_details_pkey" PRIMARY KEY ("calendar_detail_id")
);

-- CreateTable
CREATE TABLE "holiday_location_applicability" (
    "applicability_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calendar_detail_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_location_applicability_pkey" PRIMARY KEY ("applicability_id")
);

-- CreateTable
CREATE TABLE "optional_holiday_selection" (
    "selection_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "calendar_detail_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "optional_holiday_selection_pkey" PRIMARY KEY ("selection_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_master_bank_code_key" ON "bank_master"("bank_code");

-- CreateIndex
CREATE UNIQUE INDEX "country_master_country_code_key" ON "country_master"("country_code");

-- CreateIndex
CREATE UNIQUE INDEX "organization_locations_org_id_location_code_key" ON "organization_locations"("org_id", "location_code");

-- CreateIndex
CREATE UNIQUE INDEX "organization_locations_org_id_location_name_key" ON "organization_locations"("org_id", "location_name");

-- CreateIndex
CREATE UNIQUE INDEX "organization_bank_details_account_number_key" ON "organization_bank_details"("account_number");

-- CreateIndex
CREATE UNIQUE INDEX "organization_tax_details_pan_key" ON "organization_tax_details"("pan");

-- CreateIndex
CREATE UNIQUE INDEX "organization_tax_details_tan_key" ON "organization_tax_details"("tan");

-- CreateIndex
CREATE UNIQUE INDEX "organization_compliance_details_compliance_code_key" ON "organization_compliance_details"("compliance_code");

-- CreateIndex
CREATE UNIQUE INDEX "organization_compliance_details_pf_establishment_id_key" ON "organization_compliance_details"("pf_establishment_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_compliance_details_pf_number_key" ON "organization_compliance_details"("pf_number");

-- CreateIndex
CREATE UNIQUE INDEX "organization_compliance_details_esi_number_key" ON "organization_compliance_details"("esi_number");

-- CreateIndex
CREATE UNIQUE INDEX "organization_compliance_details_pt_establishment_id_key" ON "organization_compliance_details"("pt_establishment_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_compliance_details_pt_number_key" ON "organization_compliance_details"("pt_number");

-- CreateIndex
CREATE UNIQUE INDEX "organization_compliance_details_lwf_establishment_id_key" ON "organization_compliance_details"("lwf_establishment_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_types_type_name_key" ON "department_types"("type_name");

-- CreateIndex
CREATE UNIQUE INDEX "department_types_type_code_key" ON "department_types"("type_code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_dept_code_key" ON "departments"("dept_code");

-- CreateIndex
CREATE UNIQUE INDEX "employment_types_type_code_key" ON "employment_types"("type_code");

-- CreateIndex
CREATE UNIQUE INDEX "job_titles_title_code_key" ON "job_titles"("title_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_number_key" ON "employees"("employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_official_email_key" ON "employees"("official_email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_personal_email_key" ON "employees"("personal_email");

-- CreateIndex
CREATE UNIQUE INDEX "employee_bank_details_account_number_key" ON "employee_bank_details"("account_number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_financial_details_employee_id_key" ON "employee_financial_details"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_financial_details_pf_number_key" ON "employee_financial_details"("pf_number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_financial_details_uan_key" ON "employee_financial_details"("uan");

-- CreateIndex
CREATE UNIQUE INDEX "employee_financial_details_employer_esi_number_key" ON "employee_financial_details"("employer_esi_number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_financial_details_aadhar_number_key" ON "employee_financial_details"("aadhar_number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_financial_details_pan_number_key" ON "employee_financial_details"("pan_number");

-- CreateIndex
CREATE UNIQUE INDEX "salary_components_master_org_id_component_code_key" ON "salary_components_master"("org_id", "component_code");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_org_id_structure_code_key" ON "salary_structures"("org_id", "structure_code");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structure_components_structure_id_component_id_key" ON "salary_structure_components"("structure_id", "component_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_payment_components_payment_id_component_id_key" ON "employee_payment_components"("payment_id", "component_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_modules_org_id_module_code_key" ON "policy_modules"("org_id", "module_code");

-- CreateIndex
CREATE UNIQUE INDEX "policy_settings_module_id_setting_key_key" ON "policy_settings"("module_id", "setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "probation_policies_probation_code_key" ON "probation_policies"("probation_code");

-- CreateIndex
CREATE UNIQUE INDEX "probation_policies_org_id_employment_type_id_key" ON "probation_policies"("org_id", "employment_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_document_versions_module_id_version_number_key" ON "policy_document_versions"("module_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "policy_acknowledgments_version_id_employee_id_key" ON "policy_acknowledgments"("version_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_location_applicability_module_id_location_id_key" ON "policy_location_applicability"("module_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_department_applicability_module_id_dept_id_key" ON "policy_department_applicability"("module_id", "dept_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_policy_configurations_org_id_leave_type_key" ON "leave_policy_configurations"("org_id", "leave_type");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_year_key" ON "leave_balances"("employee_id", "leave_type", "year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_request_workflow_request_id_approval_order_key" ON "leave_request_workflow"("request_id", "approval_order");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_employee_id_date_key" ON "attendance"("employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_settings_org_id_key" ON "attendance_settings"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_id_attendance_date_key" ON "attendance_records"("employee_id", "attendance_date");

-- CreateIndex
CREATE UNIQUE INDEX "shift_configurations_org_id_shift_name_key" ON "shift_configurations"("org_id", "shift_name");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_calendar_years_org_id_year_key" ON "holiday_calendar_years"("org_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_master_org_id_holiday_name_key" ON "holiday_master"("org_id", "holiday_name");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_calendar_details_calendar_id_holiday_date_key" ON "holiday_calendar_details"("calendar_id", "holiday_date");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_location_applicability_calendar_detail_id_location__key" ON "holiday_location_applicability"("calendar_detail_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "optional_holiday_selection_calendar_detail_id_employee_id_key" ON "optional_holiday_selection"("calendar_detail_id", "employee_id");

-- AddForeignKey
ALTER TABLE "state_master" ADD CONSTRAINT "state_master_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "country_master"("country_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_locations" ADD CONSTRAINT "organization_locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_locations" ADD CONSTRAINT "organization_locations_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "country_master"("country_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_locations" ADD CONSTRAINT "organization_locations_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "state_master"("state_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_bank_details" ADD CONSTRAINT "organization_bank_details_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_bank_details" ADD CONSTRAINT "organization_bank_details_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "bank_master"("bank_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_tax_details" ADD CONSTRAINT "organization_tax_details_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_compliance_details" ADD CONSTRAINT "organization_compliance_details_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_dept_type_id_fkey" FOREIGN KEY ("dept_type_id") REFERENCES "department_types"("dept_type_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_dept_id_fkey" FOREIGN KEY ("parent_dept_id") REFERENCES "departments"("dept_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_titles" ADD CONSTRAINT "job_titles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "organization_locations"("location_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments"("dept_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_reporting_manager_id_fkey" FOREIGN KEY ("reporting_manager_id") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_employment_type_id_fkey" FOREIGN KEY ("employment_type_id") REFERENCES "employment_types"("employment_type_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_job_title_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "job_titles"("job_title_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_personal_details" ADD CONSTRAINT "employee_personal_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bank_details" ADD CONSTRAINT "employee_bank_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bank_details" ADD CONSTRAINT "employee_bank_details_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "bank_master"("bank_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_financial_details" ADD CONSTRAINT "employee_financial_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_financial_details" ADD CONSTRAINT "employee_financial_details_employee_bank_id_fkey" FOREIGN KEY ("employee_bank_id") REFERENCES "employee_bank_details"("employee_bank_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_residential_addresses" ADD CONSTRAINT "emp_address_employee_fk" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_residential_addresses" ADD CONSTRAINT "emp_address_country_fk" FOREIGN KEY ("country_id") REFERENCES "country_master"("country_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_residential_addresses" ADD CONSTRAINT "emp_address_state_fk" FOREIGN KEY ("state_id") REFERENCES "state_master"("state_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_components_master" ADD CONSTRAINT "salary_components_master_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structure_components" ADD CONSTRAINT "salary_structure_components_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "salary_structures"("structure_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structure_components" ADD CONSTRAINT "salary_structure_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "salary_components_master"("component_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "salary_structures"("structure_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_cycles" ADD CONSTRAINT "payroll_cycles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "payroll_cycles"("cycle_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_payments" ADD CONSTRAINT "employee_salary_payments_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("run_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_payments" ADD CONSTRAINT "employee_salary_payments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_payments" ADD CONSTRAINT "employee_salary_payments_salary_id_fkey" FOREIGN KEY ("salary_id") REFERENCES "employee_salaries"("salary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_payments" ADD CONSTRAINT "employee_salary_payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "employee_bank_details"("employee_bank_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_payment_adjustments" ADD CONSTRAINT "salary_payment_adjustments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "employee_salary_payments"("payment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_payment_adjustments" ADD CONSTRAINT "salary_payment_adjustments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payment_components" ADD CONSTRAINT "employee_payment_components_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "employee_salary_payments"("payment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payment_components" ADD CONSTRAINT "employee_payment_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "salary_components_master"("component_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_modules" ADD CONSTRAINT "policy_modules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_modules" ADD CONSTRAINT "policy_modules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_modules" ADD CONSTRAINT "policy_modules_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_settings" ADD CONSTRAINT "policy_settings_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "policy_modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_settings" ADD CONSTRAINT "policy_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_settings" ADD CONSTRAINT "policy_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_settings" ADD CONSTRAINT "policy_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probation_policies" ADD CONSTRAINT "probation_policies_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probation_policies" ADD CONSTRAINT "probation_policies_employment_type_id_fkey" FOREIGN KEY ("employment_type_id") REFERENCES "employment_types"("employment_type_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probation_policies" ADD CONSTRAINT "probation_policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probation_policies" ADD CONSTRAINT "probation_policies_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probation_policies" ADD CONSTRAINT "probation_policies_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probation_policies" ADD CONSTRAINT "probation_policies_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments"("dept_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_document_versions" ADD CONSTRAINT "policy_document_versions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "policy_modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_document_versions" ADD CONSTRAINT "policy_document_versions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_document_versions" ADD CONSTRAINT "policy_document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_document_versions" ADD CONSTRAINT "policy_document_versions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_acknowledgments" ADD CONSTRAINT "policy_acknowledgments_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "policy_document_versions"("version_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_acknowledgments" ADD CONSTRAINT "policy_acknowledgments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_location_applicability" ADD CONSTRAINT "policy_location_applicability_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "policy_modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_location_applicability" ADD CONSTRAINT "policy_location_applicability_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "organization_locations"("location_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_location_applicability" ADD CONSTRAINT "policy_location_applicability_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_department_applicability" ADD CONSTRAINT "policy_department_applicability_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "policy_modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_department_applicability" ADD CONSTRAINT "policy_department_applicability_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "departments"("dept_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_department_applicability" ADD CONSTRAINT "policy_department_applicability_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policy_configurations" ADD CONSTRAINT "leave_policy_configurations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policy_configurations" ADD CONSTRAINT "leave_policy_configurations_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "policy_modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policy_configurations" ADD CONSTRAINT "leave_policy_configurations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_policy_configurations" ADD CONSTRAINT "leave_policy_configurations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_history" ADD CONSTRAINT "leave_balance_history_balance_id_fkey" FOREIGN KEY ("balance_id") REFERENCES "leave_balances"("balance_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balance_history" ADD CONSTRAINT "leave_balance_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request_workflow" ADD CONSTRAINT "leave_request_workflow_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "leave_requests"("request_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request_workflow" ADD CONSTRAINT "leave_request_workflow_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_settings" ADD CONSTRAINT "attendance_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_settings" ADD CONSTRAINT "attendance_settings_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "policy_modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_settings" ADD CONSTRAINT "attendance_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_settings" ADD CONSTRAINT "attendance_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_swipes" ADD CONSTRAINT "attendance_swipes_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records"("record_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_swipes" ADD CONSTRAINT "attendance_swipes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records"("record_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularizations" ADD CONSTRAINT "attendance_regularizations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_configurations" ADD CONSTRAINT "shift_configurations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_configurations" ADD CONSTRAINT "shift_configurations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_configurations" ADD CONSTRAINT "shift_configurations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shift_assignments" ADD CONSTRAINT "employee_shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shift_assignments" ADD CONSTRAINT "employee_shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shift_configurations"("shift_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shift_assignments" ADD CONSTRAINT "employee_shift_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shift_assignments" ADD CONSTRAINT "employee_shift_assignments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_calendar_years" ADD CONSTRAINT "holiday_calendar_years_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_master" ADD CONSTRAINT "holiday_master_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_calendar_details" ADD CONSTRAINT "holiday_calendar_details_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "holiday_calendar_years"("calendar_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_calendar_details" ADD CONSTRAINT "holiday_calendar_details_holiday_id_fkey" FOREIGN KEY ("holiday_id") REFERENCES "holiday_master"("holiday_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_location_applicability" ADD CONSTRAINT "holiday_location_applicability_calendar_detail_id_fkey" FOREIGN KEY ("calendar_detail_id") REFERENCES "holiday_calendar_details"("calendar_detail_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_location_applicability" ADD CONSTRAINT "holiday_location_applicability_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "organization_locations"("location_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optional_holiday_selection" ADD CONSTRAINT "optional_holiday_selection_calendar_detail_id_fkey" FOREIGN KEY ("calendar_detail_id") REFERENCES "holiday_calendar_details"("calendar_detail_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optional_holiday_selection" ADD CONSTRAINT "optional_holiday_selection_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;
