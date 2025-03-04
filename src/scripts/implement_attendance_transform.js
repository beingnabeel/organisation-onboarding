/**
 * Script to add attendance_managment transformation implementation to etlService.js
 */

const fs = require('fs');
const path = require('path');

// Path to the ETL service file
const etlServicePath = path.join(__dirname, '..', 'services', 'etlService.js');
// Path to our implementation code
const attendanceTransformPath = path.join(__dirname, '..', 'services', 'attendance_transform.js');

async function implementAttendanceTransform() {
  try {
    // Read files
    const etlServiceContent = fs.readFileSync(etlServicePath, 'utf8');
    const attendanceTransformContent = fs.readFileSync(attendanceTransformPath, 'utf8');

    // Find the insertion point (right before "// Write transformed data to etltransform.json")
    const insertionPoint = etlServiceContent.indexOf('// Write transformed data to etltransform.json');
    
    if (insertionPoint === -1) {
      console.error('Could not find insertion point in etlService.js');
      return;
    }

    // Find the start of the line with the insertion point
    const lineStart = etlServiceContent.lastIndexOf('\n', insertionPoint) + 1;

    // Split the content
    const beforeInsertion = etlServiceContent.substring(0, lineStart);
    const afterInsertion = etlServiceContent.substring(lineStart);

    // Create the new content with our implementation
    const newContent = beforeInsertion + attendanceTransformContent + '\n\n' + afterInsertion;

    // Write the updated content back to etlService.js
    fs.writeFileSync(etlServicePath, newContent, 'utf8');

    console.log('Successfully implemented attendance_managment transformation');
  } catch (error) {
    console.error('Error implementing attendance transform:', error);
  }
}

// Run the implementation
implementAttendanceTransform();
