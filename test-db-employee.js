require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

/**
 * Simple database-only test for employee insertion
 */
async function testEmployeeDbInsertion() {
  console.log('\nud83dudccb DATABASE-ONLY EMPLOYEE INSERTION TEST');
  console.log('============================================');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Configured (value hidden)' : 'Not configured');
  
  try {
    // Step 1: Check for existing employees
    const existingCount = await prisma.employee.count();
    console.log(`Found ${existingCount} existing employees in database.`);
    
    // Step 2: Get required foreign key references
    console.log('\nud83dudd17 Step 1: Getting required foreign keys...');
    
    // Get a valid org_id
    const organization = await prisma.organization.findFirst();
    if (!organization) {
      console.error('u26a0ufe0f No organization found. Cannot proceed.');
      return;
    }
    console.log(`Using organization: ${organization.name} (${organization.org_id})`);
    
    // Get a valid dept_id (department)
    const department = await prisma.department.findFirst();
    if (!department) {
      console.log('u26a0ufe0f No department found. Will set dept_id to null.');
    } else {
      console.log(`Using department: ${department.name} (${department.dept_id})`);
    }
    
    // Get employment type
    const employmentType = await prisma.employmentType.findFirst();
    if (!employmentType) {
      console.log('u26a0ufe0f No employment type found. Will set employment_type_id to null.');
    } else {
      console.log(`Using employment type: ${employmentType.name} (${employmentType.employment_type_id})`);
    }
    
    // Get job title
    const jobTitle = await prisma.jobTitle.findFirst();
    if (!jobTitle) {
      console.log('u26a0ufe0f No job title found. Will set job_title_id to null.');
    } else {
      console.log(`Using job title: ${jobTitle.name} (${jobTitle.job_title_id})`);
    }
    
    // Get work location
    const workLocation = await prisma.organizationLocation.findFirst();
    if (!workLocation) {
      console.log('u26a0ufe0f No work location found. Will set work_location_id to null.');
    } else {
      console.log(`Using work location: ${workLocation.name} (${workLocation.location_id})`);
    }
    
    // Step 3: Create and insert test employee
    console.log('\nud83euddea Step 2: Creating test employee...');
    
    // Generate unique IDs
    const employeeId = uuidv4();
    const employeeNumber = `TEST-${Math.floor(Math.random() * 10000)}`;
    
    // Prepare employee data
    const employeeData = {
      employee_id: employeeId,
      org_id: organization.org_id,
      employee_number: employeeNumber,
      employment_type_id: employmentType?.employment_type_id ?? null,
      dept_id: department?.dept_id ?? null,
      work_location_id: workLocation?.location_id ?? null,
      job_title_id: jobTitle?.job_title_id ?? null,
      title: "Mr",
      first_name: "Test",
      middle_name: null,
      last_name: "Employee",
      display_name: "Test Employee",
      date_of_birth: new Date("1990-01-01"),
      gender: "male",
      official_email: "test.employee@example.com",
      personal_email: "test.personal@example.com",
      mobile_number: "9999999999",
      emergency_contact_name: "Emergency Contact",
      emergency_contact_relationship: "Parent",
      emergency_contact_number: "8888888888",
      date_joined: new Date(),
      probation_end_date: new Date(new Date().setMonth(new Date().getMonth() + 3)),
      confirmation_date: new Date(new Date().setMonth(new Date().getMonth() + 3)),
      contract_end_date: null,
      reporting_manager_id: null,
      notice_period_days: 30,
      status: "active",
    };
    
    console.log('Employee data prepared:', JSON.stringify(employeeData, null, 2));
    
    // Step 4: Insert the employee
    console.log('\nud83dudd39 Step 3: Inserting employee into database...');
    try {
      const insertedEmployee = await prisma.employee.create({
        data: employeeData
      });
      
      console.log('u2705 SUCCESS: Employee inserted successfully!');
      console.log('Inserted employee ID:', insertedEmployee.employee_id);
      console.log('Employee Number:', insertedEmployee.employee_number);
      
      // Step 5: Verify the employee was inserted
      console.log('\nud83dudd0e Step 4: Verifying employee insertion...');
      const verifiedEmployee = await prisma.employee.findUnique({
        where: { employee_id: employeeId }
      });
      
      if (verifiedEmployee) {
        console.log('u2705 VERIFICATION SUCCESS: Employee found in database!');
        console.log('Retrieved employee:', JSON.stringify(verifiedEmployee, null, 2));
      } else {
        console.log('u274c VERIFICATION FAILED: Could not find employee in database.');
      }
      
    } catch (insertError) {
      console.error('u274c INSERT FAILED:', insertError.message);
      if (insertError.meta) {
        console.error('Error details:', JSON.stringify(insertError.meta, null, 2));
      }
    }
    
  } catch (error) {
    console.error('\nu274c ERROR:', error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    // Disconnect from the database
    await prisma.$disconnect();
    console.log('\n============================================');
    console.log('ud83cudfc1 Test completed');
  }
}

testEmployeeDbInsertion().catch(console.error);
