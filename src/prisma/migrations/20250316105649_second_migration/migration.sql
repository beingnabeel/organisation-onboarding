/*
  Warnings:

  - The values [STRING,NUMBER,BOOLEAN,DATE,TIME,DATETIME,JSON,ARRAY,SELECT,MULTISELECT,TEXTAREA,PASSWORD] on the enum `SettingType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `half_day_hours` on the `attendance_settings` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(4,2)`.
  - The `dob_in_pan` column on the `employee_financial_details` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `marital_status` on table `employee_personal_details` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "HalfDayType" ADD VALUE 'none';

-- AlterEnum
ALTER TYPE "LeaveType" ADD VALUE 'none';

-- AlterEnum
ALTER TYPE "OvertimeCalculationType" ADD VALUE 'none';

-- AlterEnum
ALTER TYPE "PolicyCategory" ADD VALUE 'probation';

-- AlterEnum
BEGIN;
CREATE TYPE "SettingType_new" AS ENUM ('string', 'number', 'boolean', 'date', 'time', 'datetime', 'json', 'array', 'select', 'multi_select', 'textarea', 'password');
ALTER TABLE "policy_settings" ALTER COLUMN "setting_type" DROP DEFAULT;
ALTER TABLE "policy_settings" ALTER COLUMN "setting_type" TYPE "SettingType_new" USING ("setting_type"::text::"SettingType_new");
ALTER TYPE "SettingType" RENAME TO "SettingType_old";
ALTER TYPE "SettingType_new" RENAME TO "SettingType";
DROP TYPE "SettingType_old";
ALTER TABLE "policy_settings" ALTER COLUMN "setting_type" SET DEFAULT 'number';
COMMIT;

-- AlterTable
ALTER TABLE "attendance_settings" ALTER COLUMN "half_day_hours" SET DATA TYPE DECIMAL(4,2),
ALTER COLUMN "overtime_calculation_type" SET DEFAULT 'none',
ALTER COLUMN "late_penalty_type" DROP NOT NULL,
ALTER COLUMN "late_penalty_leave_type" SET DEFAULT 'none';

-- AlterTable
ALTER TABLE "employee_financial_details" DROP COLUMN "dob_in_pan",
ADD COLUMN     "dob_in_pan" DATE;

-- AlterTable
ALTER TABLE "employee_personal_details" ALTER COLUMN "marital_status" SET NOT NULL,
ALTER COLUMN "marital_status" SET DEFAULT 'single',
ALTER COLUMN "spouse_gender" SET DEFAULT 'female';

-- AlterTable
ALTER TABLE "employee_shift_assignments" ALTER COLUMN "effective_from" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "effective_to" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "employees" ALTER COLUMN "gender" SET DEFAULT 'male';

-- AlterTable
ALTER TABLE "holiday_calendar_details" ALTER COLUMN "holiday_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "half_day_type" SET DEFAULT 'none';

-- AlterTable
ALTER TABLE "holiday_calendar_years" ALTER COLUMN "start_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "end_date" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "holiday_master" ALTER COLUMN "holiday_type" SET DEFAULT 'religious',
ALTER COLUMN "recurrence_type" SET DEFAULT 'yearly_variable_date';

-- AlterTable
ALTER TABLE "leave_policy_configurations" ALTER COLUMN "leave_type" SET DEFAULT 'casual',
ALTER COLUMN "accrual_frequency" SET DEFAULT 'monthly';

-- AlterTable
ALTER TABLE "organization_compliance_details" ALTER COLUMN "compliance_code" SET DATA TYPE VARCHAR(10);

-- AlterTable
ALTER TABLE "policy_document_versions" ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "policy_modules" ALTER COLUMN "module_category" SET DEFAULT 'probation',
ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "policy_settings" ALTER COLUMN "setting_type" SET DEFAULT 'number';

-- AlterTable
ALTER TABLE "salary_components_master" ALTER COLUMN "component_category" SET DEFAULT 'earnings',
ALTER COLUMN "component_type" SET DEFAULT 'fixed';
