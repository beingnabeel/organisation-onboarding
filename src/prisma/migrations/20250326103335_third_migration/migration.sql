/*
  Warnings:

  - You are about to alter the column `days_per_year` on the `leave_policy_configurations` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,2)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "leave_policy_configurations" ALTER COLUMN "days_per_year" SET DEFAULT 0,
ALTER COLUMN "days_per_year" SET DATA TYPE INTEGER;
