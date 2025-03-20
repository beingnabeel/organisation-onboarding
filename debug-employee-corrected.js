/**
 * Enhanced Debug script to test the Employee API with dependency creation
 * This script will create all required foreign key references before attempting to insert an employee
 */
require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

// Base URL for the API
const BASE_URL = process.env.BASE_URL || 'http://localhost:8085';
const prisma = new PrismaClient();

// Test data for an employee record with all required fields
const testEmployee = {
  employee_id: "3ae28254-ddd2-5336-8228-d9331509f6a6",
  org_id: "98ec4577-5ea3-5c3e-a88a-9be230834a8f",
  employee_number: "kl000041",
  employment_type_id: "0cc95bb2-8ee6-518f-8c0a-eae8370cda0f",
  dept_id: "caa2a350-b332-5714-9c86-74336350e9f5",
  work_location_id: "973e7510-3b4f-543e-98b1-170895493d0c",
  job_title_id: "eb41eb4a-d193-5678-823e-ae88e968a9ba",
  title: "mr",
  first_name: "nabeel",
  middle_name: null,
  last_name: "hassan",
  display_name: "nabeel hassan",
  date_of_birth: "2001-02-28T18:29:50.000Z",
  gender: "male",
  official_email: "nabeel.hassan@kibalabs.in",
  personal_email: "sk.hassan2013@gmail.com",
  mobile_number: "9852369870",
  emergency_contact_name: "hassan nabeel",
  emergency_contact_relationship: "himself",
  emergency_contact_number: "9608020606",
  date_joined: "2024-10-13T18:29:50.000Z",
  probation_end_date: "2025-03-13T18:29:50.000Z",
  confirmation_date: "2025-03-14T18:29:50.000Z",
  contract_end_date: null,
  reporting_manager_id: null,
  notice_period_days: 60,
  status: "active",
  created_at: "2025-03-17T10:25:59.436Z",
  updated_at: "2025-03-17T10:25:59.436Z"
};

// Function to ensure all required dependencies exist
async function ensureDependencies() {
  console.log('\nud83dudd17 Checking and creating required dependencies...');
  
  try {
    // 1. Check/Create Organization
    const orgExists = await prisma.organization.findUnique({
      where: { org_id: testEmployee.org_id }
    });
    
    if (!orgExists) {
      console.log(`Creating organization with ID: ${testEmployee.org_id}`);
      await prisma.organization.create({
        data: {
          org_id: testEmployee.org_id,
          name: 'Kiba Labs Organization',
          display_name: 'Kiba Labs',
          org_type: 'company',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      console.log('u2705 Organization created successfully');
    } else {
      console.log(`u2705 Organization exists: ${orgExists.name}`);
    }
    
    // 2. Check/Create Department
    const deptExists = await prisma.department.findUnique({
      where: { dept_id: testEmployee.dept_id }
    });
    
    if (!deptExists) {
      console.log(`Creating department with ID: ${testEmployee.dept_id}`);
      await prisma.department.create({
        data: {
          dept_id: testEmployee.dept_id,
          org_id: testEmployee.org_id,
          name: 'Engineering',
          code: 'ENG',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      console.log('u2705 Department created successfully');
    } else {
      console.log(`u2705 Department exists: ${deptExists.name}`);
    }
    
    // 3. Check/Create Employment Type
    const empTypeExists = await prisma.employmentType.findUnique({
      where: { employment_type_id: testEmployee.employment_type_id }
    });
    
    if (!empTypeExists) {
      console.log(`Creating employment type with ID: ${testEmployee.employment_type_id}`);
      await prisma.employmentType.create({
        data: {
          employment_type_id: testEmployee.employment_type_id,
          org_id: testEmployee.org_id,
          name: 'Full Time',
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      console.log('u2705 Employment Type created successfully');
    } else {
      console.log(`u2705 Employment Type exists: ${empTypeExists.name}`);
    }
    
    // 4. Check/Create Organization Location (for work_location_id)
    const orgLocExists = await prisma.organizationLocation.findUnique({
      where: { location_id: testEmployee.work_location_id }
    });
    
    if (!orgLocExists) {
      console.log(`Creating organization location with ID: ${testEmployee.work_location_id}`);
      await prisma.organizationLocation.create({
        data: {
          location_id: testEmployee.work_location_id,
          organizationId: testEmployee.org_id, // mapped to org_id in schema
          location_name: 'Bangalore Office',
          location_code: 'BLR-01',
          address_line1: '123 Tech Park',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      console.log('u2705 Organization Location created successfully');
    } else {
      console.log(`u2705 Organization Location exists: ${orgLocExists.location_name}`);
    }
    
    // 5. Check/Create Job Title
    const jobTitleExists = await prisma.jobTitle.findUnique({
      where: { job_title_id: testEmployee.job_title_id }
    });
    
    if (!jobTitleExists) {
      console.log(`Creating job title with ID: ${testEmployee.job_title_id}`);
      await prisma.jobTitle.create({
        data: {
          job_title_id: testEmployee.job_title_id,
          org_id: testEmployee.org_id,
          name: 'Software Engineer',
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      console.log('u2705 Job Title created successfully');
    } else {
      console.log(`u2705 Job Title exists: ${jobTitleExists.name}`);
    }
    
    console.log('\nu2705 All dependencies created/verified successfully');
    return true;
  } catch (error) {
    console.error('u274c Error creating dependencies:', error);
    return false;
  }
}

// Function to test the employee API
async function testEmployeeAPI() {
  console.log('\nud83dudccb EMPLOYEE API TEST - DEBUGGING SESSION');
  console.log('======================================');
  
  // Step 1: Ensure all dependencies exist
  const dependenciesOk = await ensureDependencies();
  if (!dependenciesOk) {
    console.error('u274c Cannot proceed with employee creation due to dependency issues');
    return;
  }
  
  try {
    // Step 2: Create employee via API
    console.log('\nud83dudc64 Attempting to create employee...');
    const createResponse = await axios.post(
      `${BASE_URL}/api/v1/tenant-onboarding/employees`,
      testEmployee
    );
    console.log('u2705 Employee creation response status:', createResponse.status, createResponse.statusText);
    console.log('Response data:', JSON.stringify(createResponse.data, null, 2));

    // If successful, let's try to retrieve the employee
    console.log('\nud83dudd0d Attempting to retrieve the created employee...');
    const getResponse = await axios.get(
      `${BASE_URL}/api/v1/tenant-onboarding/employees/${testEmployee.employee_id}`
    );
    console.log('u2705 Employee retrieval response status:', getResponse.status, getResponse.statusText);
    console.log('Employee data:', JSON.stringify(getResponse.data, null, 2));
    
    console.log('\nu2705 TEST PASSED: Employee created and retrieved successfully!');
  } catch (error) {
    console.error('\nu274c Error occurred:');
    if (error.response) {
      // The request was made and the server responded with a status code that falls out of the range of 2xx
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
      console.error('Request details:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
    console.error('Error stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testEmployeeAPI();
