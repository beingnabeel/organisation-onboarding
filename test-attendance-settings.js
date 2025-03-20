const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const logger = require('./src/utils/logger');

const prisma = new PrismaClient();

async function testAttendanceSettings() {
  try {
    // Sample AttendanceSettings data from failed_data.json
    const data = {
      "id": "07cde23e-f8b4-5f04-bd93-c003385cd444",
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
      "flexibleHours": null,
      "gracePeriodMinutes": 15,
      "halfDayHours": "4.00",
      "fullDayHours": "8.00",
      "breakDurationMinutes": 60,
      "workDaysPerWeek": 5,
      "overtimePolicyEnabled": true,
      "minimumOvertimeMinutes": 30,
      "overtimeCalculationType": null,
      "maxOvertimeHoursMonthly": null,
      "latePenaltyType": "none",
      "latePenaltyLeaveType": null,
      "missingSwipePolicy": "automatic",
      "autoCheckoutEnabled": false,
      "autoCheckoutTime": null,
      "regularizationAllowed": true,
      "regularizationWindowDays": 5,
      "regularizationLimitMonthly": 2,
      "weekendOvertimeMultiplier": "1.50",
      "holidayOvertimeMultiplier": "2.00",
      "status": "active",
      "createdAt": "2025-03-17T07:53:01.302Z",
      "updatedAt": "2025-03-17T07:53:01.302Z",
      "createdBy": "3ae28254-ddd2-5336-8228-d9331509f6a6",
      "updatedBy": "3ae28254-ddd2-5336-8228-d9331509f6a6"
    };

    // Test case 1: Using the ID
    console.log('\n=== TEST 1: Using ID ===');
    console.log(`Attempting upsert with ID: ${data.id}`);
    const result1 = await prisma.AttendanceSettings.upsert({
      where: { id: data.id },
      update: data,
      create: data
    });
    console.log('Success! Result:', result1.id);

    // Test case 2: Using organizationId (unique constraint)
    console.log('\n=== TEST 2: Using organizationId unique constraint ===');
    const dataWithoutId = { ...data };
    delete dataWithoutId.id;
    console.log(`Attempting upsert with organizationId: ${dataWithoutId.organizationId}`);
    const result2 = await prisma.AttendanceSettings.upsert({
      where: { 
        unique_org_attendance_settings: {
          organizationId: dataWithoutId.organizationId
        } 
      },
      update: dataWithoutId,
      create: dataWithoutId
    });
    console.log('Success! Result:', result2.id);

    console.log('\nAll tests passed successfully!');
  } catch (error) {
    console.error('Error during test:', error.message);
    if (error.meta) {
      console.error('Prisma metadata:', error.meta);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testAttendanceSettings()
  .then(() => console.log('Test complete.'))
  .catch(err => console.error('Unhandled error:', err));
