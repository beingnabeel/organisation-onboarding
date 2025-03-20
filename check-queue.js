const amqp = require('amqplib');
const { logger } = require('./src/utils/logger');

// Queue configuration
const EXCHANGE = 'etl_exchange';
const QUEUE = 'passed_data';

async function checkQueueContent() {
  try {
    // Connect to RabbitMQ
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    const channel = await connection.createChannel();
    
    // Get queue info
    const queueInfo = await channel.assertQueue(QUEUE, { durable: true });
    console.log(`Queue '${QUEUE}' has ${queueInfo.messageCount} messages waiting`);
    
    // Sample messages without consuming them
    const maxMessages = 10; // Limit the number of messages to check
    let messageCount = 0;
    let employeeCount = 0;
    
    // Use get instead of consume to peek at messages without removing them
    while (messageCount < maxMessages) {
      const message = await channel.get(QUEUE, { noAck: true });
      if (!message) {
        console.log('No more messages in queue');
        break;
      }
      
      messageCount++;
      try {
        const content = JSON.parse(message.content.toString());
        const schemaName = identifySchema(content);
        
        console.log(`Message ${messageCount}: Schema ${schemaName}, ID: ${getPrimaryKeyValue(content, schemaName)}`);
        
        if (schemaName === 'Employee') {
          employeeCount++;
          console.log(`Found Employee record: ${JSON.stringify(content, null, 2)}`);
        }
      } catch (error) {
        console.error(`Error parsing message ${messageCount}: ${error.message}`);
      }
    }
    
    console.log(`Checked ${messageCount} messages, found ${employeeCount} Employee records`);
    
    // Close connection
    await channel.close();
    await connection.close();
  } catch (error) {
    console.error(`Error checking queue: ${error.message}`);
  }
}

// Simple schema identifier based on primary keys
function identifySchema(data) {
  const schemaMap = {
    employee_id: 'Employee',
    org_id: 'Organization',
    bank_id: 'BankMaster',
    empl_personal_det_id: 'EmployeePersonalDetail',
    employee_bank_id: 'EmployeeBankDetail',
    empl_financial_id: 'EmployeeFinancialDetail'
  };
  
  for (const [key, schema] of Object.entries(schemaMap)) {
    if (data[key]) {
      return schema;
    }
  }
  
  return 'Unknown';
}

// Get the primary key value based on schema
function getPrimaryKeyValue(data, schemaName) {
  const pkMapping = {
    'Employee': 'employee_id',
    'Organization': 'org_id',
    'BankMaster': 'bank_id',
    'EmployeePersonalDetail': 'empl_personal_det_id',
    'EmployeeBankDetail': 'employee_bank_id',
    'EmployeeFinancialDetail': 'empl_financial_id'
  };
  
  return data[pkMapping[schemaName]] || 'unknown';
}

// Run the check
checkQueueContent();
