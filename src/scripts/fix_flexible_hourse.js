/**
 * Script to fix the flexible_hours field name in the attendance transformation
 */

const fs = require('fs');
const path = require('path');

// Path to the ETL service file
const etlServicePath = path.join(__dirname, '..', 'services', 'etlService.js');

async function fixFlexibleHourseField() {
  try {
    // Read the file
    const etlServiceContent = fs.readFileSync(etlServicePath, 'utf8');

    // Find the flexible_hours field and replace it with flexible_hourse
    const updatedContent = etlServiceContent.replace(
      'flexible_hours: flexibleHours,',
      'flexible_hourse: flexibleHours,'
    );

    // Write the updated content back to etlService.js
    fs.writeFileSync(etlServicePath, updatedContent, 'utf8');

    console.log('Successfully fixed flexible_hours field name to flexible_hourse');
  } catch (error) {
    console.error('Error fixing flexible_hourse field:', error);
  }
}

// Run the fix
fixFlexibleHourseField();
