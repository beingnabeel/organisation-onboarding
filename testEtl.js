const path = require('path');
const etlService = require('./src/services/etlService');

async function runEtl() {
  try {
    console.log('Starting ETL process...');
    
    // Step 1: Parse Excel file
    const filePath = path.resolve(__dirname, './kiba_labs_data_sheet_new.xlsx');
    await etlService.parseExcelFile(filePath);
    console.log('Excel file parsed successfully and written to etlextract.json');
    
    // Step 2: Transform data
    await etlService.transformData();
    console.log('Data transformed successfully and written to etltransform.json');
    
    console.log('ETL process completed successfully!');
  } catch (error) {
    console.error('Error in ETL process:', error);
  }
}

// Run the ETL process
runEtl();
