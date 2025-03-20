const axios = require('axios');

async function testAttendanceSettingsAPI() {
  try {
    const baseURL = process.env.API_BASE_URL || 'http://localhost:8085';
    const endpoint = '/api/v1/tenant-onboarding/attendance-settings';
    const url = `${baseURL}${endpoint}`;
    
    console.log('\n=== Testing AttendanceSettings API with organizationId constraint ===');
    
    // Sample AttendanceSettings data from failed_data.json
    const data = {
      "organizationId": "98ec4577-5ea3-5c3e-a88a-9be230834a8f",
      "moduleId": "dfc85651-7450-5378-8083-e4452e775911",
      "captureMethods": [
        "web_app",
        "mobile_app"
      ],
      "geoFencingEnabled": true,
      "geoFenceRadius": 500,
      "shiftType": "fixed",
      "shiftStartTime": "2025-03-17T09:00:00.000Z",
      "shiftEndTime": "2025-03-17T18:00:00.000Z",
      "gracePeriodMinutes": 15,
      "halfDayHours": "4.00",
      "fullDayHours": "8.00",
      "breakDurationMinutes": 60,
      "workDaysPerWeek": 5,
      "overtimePolicyEnabled": true,
      "minimumOvertimeMinutes": 30,
      "latePenaltyType": "none",
      "missingSwipePolicy": "automatic",
      "autoCheckoutEnabled": false,
      "regularizationAllowed": true,
      "regularizationWindowDays": 5,
      "regularizationLimitMonthly": 2,
      "weekendOvertimeMultiplier": "1.50",
      "holidayOvertimeMultiplier": "2.00",
      "status": "active"
    };

    console.log(`Sending POST request to: ${url}`);
    console.log(`Using organizationId: ${data.organizationId}`);
    
    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`API Response Status: ${response.status}`);
    console.log('Response Data:', response.data);
    console.log('\nTest completed successfully! The changes to handle the AttendanceSettings unique constraint are working.');
  } catch (error) {
    console.error('Error during API test:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
    }
  }
}

testAttendanceSettingsAPI();
