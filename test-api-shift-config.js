const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8085';

// Use a consistent test UUID (this would normally come from your database)
// In a real scenario, this would be an actual organization ID from your database
const TEST_ORG_ID = "98ec4577-5ea3-5c3e-a88a-9be230834a8f"; // Use same ID from AttendanceSettings test

// Test data for ShiftConfiguration
const shiftConfigData = {
  org_id: TEST_ORG_ID, // Using a consistent test organization ID
  shift_name: "Morning Shift",
  shift_type: "fixed", // Valid values are: fixed, flexible, rotational
  start_time: new Date().toISOString(), // Full ISO-8601 DateTime format
  end_time: new Date().toISOString(), // Full ISO-8601 DateTime format
  break_duration: 60,
  grace_period_minutes: 15,
  half_day_hours: 4.5,
  full_day_hours: 9.0,
  description: "Standard morning shift with 1-hour break",
  status: "active",
  // Deliberately providing possibly invalid references to test validation
  created_by: "22222222-2222-2222-2222-222222222222",
  updated_by: "22222222-2222-2222-2222-222222222222"
};

async function testShiftConfigAPI() {
  try {
    console.log('Testing ShiftConfiguration API...');
    
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/tenant-onboarding/shift-configurations`,
      shiftConfigData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('ShiftConfiguration API Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.status === 'success') {
      console.log('Successfully created/updated ShiftConfiguration');
      const shiftId = response.data.data.shift_id;
      
      // Now test EmployeeShiftAssignment
      await testEmployeeShiftAssignment(shiftId);
    } else {
      console.error('Failed to create/update ShiftConfiguration:', response.data.message);
      
      // If there was an organization-related error, log it clearly
      if (response.data.message.includes('Organization')) {
        console.error('This test requires a valid organization ID. Please update the TEST_ORG_ID variable with a valid UUID from your database.');
      }
    }
  } catch (error) {
    console.error('Error testing ShiftConfiguration API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

async function testEmployeeShiftAssignment(shiftId) {
  try {
    console.log('Testing EmployeeShiftAssignment API...');
    
    // Use a consistent test UUID for employee (this would normally come from your database)
    const TEST_EMPLOYEE_ID = "34567890-1234-5678-9012-345678901234";
    
    const assignmentData = {
      employee_id: TEST_EMPLOYEE_ID, // Using a consistent test employee ID
      shift_id: shiftId,
      effective_from: new Date().toISOString(),
      effective_to: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
      created_by: "44444444-4444-4444-4444-444444444444", // Possibly invalid reference
      updated_by: "44444444-4444-4444-4444-444444444444"  // Possibly invalid reference
    };
    
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/tenant-onboarding/employee-shift-assignments`,
      assignmentData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('EmployeeShiftAssignment API Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.status === 'success') {
      console.log('Successfully created/updated EmployeeShiftAssignment');
    } else {
      console.error('Failed to create/update EmployeeShiftAssignment:', response.data.message);
    }
  } catch (error) {
    console.error('Error testing EmployeeShiftAssignment API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testShiftConfigAPI();
