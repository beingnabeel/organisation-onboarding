require('dotenv').config();

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Configured (value hidden)' : 'Not configured');

// Check for required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'PORT',
  'NODE_ENV'
];

console.log('\nEnvironment Variables Check:');
console.log('===========================');

requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`✅ ${varName}: Configured`);
  } else {
    console.log(`❌ ${varName}: Not configured`);
  }
});

// Check if dotenv is properly loading the .env file
const fs = require('fs');
if (fs.existsSync('.env')) {
  console.log('\n✅ .env file exists');
  
  // Count how many lines with content are in the .env file
  const envContent = fs.readFileSync('.env', 'utf8');
  const nonEmptyLines = envContent.split('\n')
    .filter(line => line.trim() && !line.trim().startsWith('#'))
    .length;
  
  console.log(`   Found ${nonEmptyLines} non-empty, non-comment lines in .env`);
} else {
  console.log('\n❌ .env file does not exist');
}

// Check if app is properly importing dotenv
const appJs = fs.existsSync('./app.js') ? fs.readFileSync('./app.js', 'utf8') : '';
const dotenvImport = appJs.includes('require(\'dotenv\')') || 
                    appJs.includes('require("dotenv")') ||
                    appJs.includes('import * as dotenv');

if (dotenvImport) {
  console.log('\n✅ app.js imports dotenv');
} else {
  console.log('\n❌ app.js does not import dotenv');
  console.log('   This may prevent environment variables from loading correctly');
}
