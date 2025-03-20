require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const net = require('net');

// Extract database connection info from the environment variable
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Parse the database URL to extract host and port
const matches = dbUrl.match(/postgres:\/\/.*:.*@([^:]+):(\d+)\/.*/);
if (!matches) {
  console.error('Failed to parse DATABASE_URL');
  process.exit(1);
}

const host = matches[1];
const port = parseInt(matches[2], 10);

console.log('🔍 DATABASE CONNECTION DIAGNOSIS');
console.log('================================');
console.log(`Host: ${host}`);
console.log(`Port: ${port}`);
console.log('--------------------------------');

// Function to check if the host is reachable using a TCP connection
async function checkTcpConnection() {
  return new Promise((resolve) => {
    console.log(`\n📡 Testing TCP connectivity to ${host}:${port}...`);
    
    const socket = net.createConnection(port, host);
    const timeout = setTimeout(() => {
      socket.destroy();
      console.log('❌ Connection timed out after 5 seconds');
      resolve(false);
    }, 5000);
    
    socket.on('connect', () => {
      clearTimeout(timeout);
      console.log('✅ TCP connection successful');
      socket.end();
      resolve(true);
    });
    
    socket.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`❌ TCP connection failed: ${err.message}`);
      resolve(false);
    });
  });
}

// Function to check using ping
async function checkPing() {
  return new Promise((resolve) => {
    console.log(`\n📡 Pinging ${host}...`);
    
    exec(`ping -c 3 ${host}`, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ Ping failed: ${error.message}`);
        resolve(false);
        return;
      }
      
      console.log('✅ Ping results:');
      console.log(stdout);
      resolve(true);
    });
  });
}

// Function to try connecting with Prisma
async function checkPrismaConnection() {
  console.log('\n📡 Testing database connection with Prisma...');
  
  const prisma = new PrismaClient();
  
  try {
    // Try to query the database
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    console.log('✅ Prisma connection successful');
    console.log('Database query result:', result);
    return true;
  } catch (error) {
    console.log('❌ Prisma connection failed:');
    console.log(error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run all tests
async function runTests() {
  console.log('\n🔄 RUNNING CONNECTION TESTS\n');
  
  // Test 1: Ping
  const pingResult = await checkPing();
  
  // Test 2: TCP Connection
  const tcpResult = await checkTcpConnection();
  
  // Test 3: Prisma Connection
  const prismaResult = await checkPrismaConnection();
  
  console.log('\n📊 SUMMARY OF RESULTS');
  console.log('================================');
  console.log(`Ping Test: ${pingResult ? '✅ Passed' : '❌ Failed'}`);
  console.log(`TCP Connection: ${tcpResult ? '✅ Passed' : '❌ Failed'}`);
  console.log(`Prisma Connection: ${prismaResult ? '✅ Passed' : '❌ Failed'}`);
  console.log('================================');
  
  if (!pingResult && !tcpResult && !prismaResult) {
    console.log('\n❌ DIAGNOSIS: Host is completely unreachable.');
    console.log('\nPOSSIBLE SOLUTIONS:');
    console.log('1. Check if the Aiven database service is running');
    console.log('2. Verify firewall settings allow outbound connections to the database server');
    console.log('3. Check if the database credentials in your .env file are up-to-date');
    console.log('4. Verify that the database service has not been paused or deleted');
    console.log('5. Contact your database administrator to check if there are server issues');
  } else if (!prismaResult) {
    console.log('\n⚠️ DIAGNOSIS: Host is reachable but database connection fails.');
    console.log('\nPOSSIBLE SOLUTIONS:');
    console.log('1. Verify database credentials (username/password)');
    console.log('2. Check if the database name exists');
    console.log('3. Ensure SSL settings are correct (sslmode=require)');
    console.log('4. Verify database user has proper permissions');
  }
}

runTests();
