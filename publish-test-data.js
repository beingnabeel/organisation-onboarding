require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mqService = require('./src/services/mqService');
const { logger } = require('./src/utils/logger');

// Read test data from passed_data.json
async function publishTestData() {
  try {
    // Read test data
    const testDataPath = path.join(__dirname, 'passed_data.json');
    const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
    
    console.log(`\u2705 Loaded ${testData.length} test objects from passed_data.json`);

    // Connect to RabbitMQ
    await mqService.connect();
    console.log('\u2705 Connected to RabbitMQ');
    
    // Publish each object with a small delay to avoid overwhelming the consumer
    console.log('\nPublishing test data to the passed_data queue:');
    let successCount = 0;
    
    for (let i = 0; i < testData.length; i++) {
      const item = testData[i];
      try {
        // Publish the item to the passed queue
        const published = await mqService.publishToPassed(item);
        if (published) {
          successCount++;
          console.log(`\u2705 [${i + 1}/${testData.length}] Object published successfully`);
          
          // Adding object type info for better logging
          const objectType = determineObjectType(item);
          console.log(`   Object type: ${objectType || 'Unknown'}`);
        } else {
          console.error(`\u274c [${i + 1}/${testData.length}] Failed to publish object`);
        }
        
        // Add a small delay between messages (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`\u274c [${i + 1}/${testData.length}] Error publishing object:`, error.message);
      }
    }

    console.log(`\n\u2705 Finished publishing ${successCount}/${testData.length} objects to RabbitMQ`);
    console.log('The consumer should now process these messages from the queue.');
    
    // Close the connection
    await mqService.close();
    console.log('\u2705 Closed RabbitMQ connection');
  } catch (error) {
    console.error('\u274c Error in test data publishing process:', error.message);
    process.exit(1);
  }
}

// Helper function to determine the type of object (simplified version)
function determineObjectType(data) {
  if (data.org_id && data.legal_entity_name) return 'Organization';
  if (data.bank_id && data.bank_type) return 'BankMaster';
  if (data.org_bank_id) return 'OrganizationBankDetail';
  if (data.org_tax_id) return 'OrganizationTaxDetail';
  if (data.org_compliance_id) return 'OrganizationComplianceDetail';
  if (data.country_id && data.country_code) return 'CountryMaster';
  if (data.state_id && data.country_id) return 'StateMaster';
  if (data.location_id) return 'OrganizationLocation';
  if (data.dept_type_id && data.type_name) return 'DepartmentType';
  if (data.dept_id) return 'Department';
  if (data.employment_type_id && data.type_name) return 'EmploymentType';
  if (data.job_title_id) return 'JobTitle';
  if (data.employee_id && data.employee_number) return 'Employee';
  if (data.empl_personal_det_id) return 'EmployeePersonalDetail';
  if (data.employee_bank_id) return 'EmployeeBankDetail';
  if (data.empl_financial_id) return 'EmployeeFinancialDetail';
  if (data.component_id) return 'SalaryComponentMaster';
  if (data.structure_id && data.structure_name) return 'SalaryStructure';
  if (data.structure_component_id) return 'SalaryStructureComponent';
  if (data.salary_id) return 'EmployeeSalary';
  if (data.cycle_id) return 'PayrollCycle';
  if (data.run_id) return 'PayrollRun';
  if (data.module_id && data.module_name) return 'PolicyModule';
  if (data.setting_id) return 'PolicySetting';
  if (data.policy_id) return 'ProbationPolicy';
  if (data.version_id) return 'PolicyDocumentVersion';
  if (data.acknowledgment_id) return 'PolicyAcknowledgment';
  if (data.config_id) return 'LeavePolicyConfiguration';
  if (data.calendar_id) return 'HolidayCalendarYear';
  if (data.holiday_id) return 'HolidayMaster';
  if (data.calendar_detail_id) return 'HolidayCalendarDetail';
  if (data.id && data.captureMethods) return 'AttendanceSettings';
  if (data.shift_id) return 'ShiftConfiguration';
  if (data.assignment_id) return 'EmployeeShiftAssignment';
  
  return null;
}

// Run the function if this file is executed directly
if (require.main === module) {
  publishTestData();
}
