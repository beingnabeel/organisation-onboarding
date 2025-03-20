/**
 * Debug script to test the Employee API and understand why employee records are not being inserted
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

// Function to test the employee API
async function testEmployeeAPI() {
  console.log('Starting employee API test');
  console.log('Test data:', JSON.stringify(testEmployee, null, 2));

  try {
    // Skip health check and go directly to employee creation

    // Now let's try to create an employee
    console.log('\nAttempting to create employee...');
    const createResponse = await axios.post(
      `${BASE_URL}/api/v1/tenant-onboarding/employees`,
      testEmployee
    );
    console.log('Employee creation response status:', createResponse.status, createResponse.statusText);
    console.log('Employee creation response data:', JSON.stringify(createResponse.data, null, 2));

    // If successful, let's try to retrieve the employee
    if (createResponse.status === 201) {
      console.log('\nAttempting to retrieve the created employee...');
      const getResponse = await axios.get(
        `${BASE_URL}/api/v1/tenant-onboarding/employees/${testEmployee.employee_id}`
      );
      console.log('Employee retrieval response status:', getResponse.status, getResponse.statusText);
      console.log('Employee retrieval response data:', JSON.stringify(getResponse.data, null, 2));
    }
  } catch (error) {
    console.error('\nError occurred:');
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
  }
}

// Run the test
testEmployeeAPI();
