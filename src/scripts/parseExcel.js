const xlsx = require('xlsx');
const fs = require('fs');

async function parseExcelToJson() {
  try {
    // Read the Excel file
    const workbook = xlsx.readFile('kiba_labs_data_sheet_new.xlsx');
    
    // Initialize output object
    const output = {};

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      console.log(`Processing sheet: ${sheetName}`);
      
      // Convert sheet to JSON
      const sheet = workbook.Sheets[sheetName];
      output[sheetName] = xlsx.utils.sheet_to_json(sheet, {
        raw: true,
        defval: null,
        header: 1 // Use 1-based array of values
      });
    }

    // Write to output file
    fs.writeFileSync('output.json', JSON.stringify(output, null, 2));
    console.log('Successfully wrote data to output.json');

  } catch (error) {
    console.error('Error processing Excel file:', error);
  }
}

parseExcelToJson();
