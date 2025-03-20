const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('./src/utils/logger');
const config = require('./src/config');

/**
 * Test script to verify employee object insertion
 * This script creates and inserts a test employee record
 */
async function testEmployeeInsertion() {
  try {
    const baseURL = 'http://localhost:3001'; // Adjust to match your API URL
    
    // Generate unique IDs for testing
    const employeeId = uuidv4();
    const employeeNumber = `TEST-${Math.floor(Math.random() * 10000)}`;
    
    // Create a test employee object
    const employeeData = {
      employee_id: employeeId,
      org_id: "98ec4577-5ea3-5c3e-a88a-9be230834a8f", // Use a valid org_id from your database
      employee_number: employeeNumber,
      employment_type_id: "0cc95bb2-8ee6-518f-8c0a-eae8370cda0f", // Use a valid employment_type_id
      dept_id: "caa2a350-b332-5714-9c86-74336350e9f5", // Use a valid dept_id
      work_location_id: "973e7510-3b4f-543e-98b1-170895493d0c", // Use a valid work_location_id
      job_title_id: "eb41eb4a-d193-5678-823e-ae88e968a9ba", // Use a valid job_title_id
      title: "Mr",
      first_name: "Test",
      middle_name: null,
      last_name: "Employee",
      display_name: "Test Employee",
      date_of_birth: new Date("1990-01-01").toISOString(),
      gender: "male",
      official_email: "test.employee@example.com",
      personal_email: "test.personal@example.com",
      mobile_number: "9999999999",
      emergency_contact_name: "Emergency Contact",
      emergency_contact_relationship: "Parent",
      emergency_contact_number: "8888888888",
      date_joined: new Date().toISOString(),
      probation_end_date: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
      confirmation_date: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
      contract_end_date: null,
      reporting_manager_id: null,
      notice_period_days: 30,
      status: "active",
    };
    
    console.log('Attempting to insert test employee:', employeeData);
    
    // Send POST request to insert employee
    const employeeResponse = await axios.post(
      `${baseURL}/api/employees`, 
      employeeData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Employee insertion response:', employeeResponse.data);
    
    if (employeeResponse.data.status === 'success') {
      console.log('✅ SUCCESS: Employee inserted successfully!');
      
      // Verify the employee was inserted by retrieving it
      const verifyResponse = await axios.get(
        `${baseURL}/api/employees/${employeeId}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Employee verification response:', verifyResponse.data);
      
      if (verifyResponse.data.status === 'success') {
        console.log('✅ VERIFICATION SUCCESS: Employee retrieved successfully!');
      } else {
        console.log('❌ VERIFICATION FAILED: Could not retrieve the inserted employee');
      }
    } else {
      console.log('❌ INSERTION FAILED: Could not insert employee');
    }
    
  } catch (error) {
    console.error('Error during test:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testEmployeeInsertion();
