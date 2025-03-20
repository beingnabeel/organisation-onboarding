const amqp = require('amqplib');
require('dotenv').config();

// Create a simple logger since the imported one might not be properly configured outside the main app
const logger = {
  info: (data) => {
    console.log(`INFO: ${data.message}`, data.metadata || '');
  },
  error: (data) => {
    console.error(`ERROR: ${data.message}`, data.error ? data.error.stack : '', data.metadata || '');
  },
  warn: (data) => {
    console.warn(`WARN: ${data.message}`, data.metadata || '');
  }
};

async function checkQueueForEmployeeRecords() {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
  const queueName = process.env.RABBITMQ_QUEUE || 'passed_data';
  
  try {
    logger.info({
      message: `Connecting to RabbitMQ at ${rabbitmqUrl}`,
      timestamp: new Date().toISOString(),
    });
    
    // Connect to RabbitMQ
    const connection = await amqp.connect(rabbitmqUrl);
    const channel = await connection.createChannel();
    
    // Assert the queue exists
    await channel.assertQueue(queueName, { durable: true });
    
    // Get queue info
    const queueInfo = await channel.checkQueue(queueName);
    logger.info({
      message: `Queue ${queueName} has ${queueInfo.messageCount} messages`,
      timestamp: new Date().toISOString(),
    });
    
    // If no messages, exit
    if (queueInfo.messageCount === 0) {
      logger.info({
        message: `No messages in queue ${queueName}`,
        timestamp: new Date().toISOString(),
      });
      await connection.close();
      return;
    }
    
    let employeeCount = 0;
    let messageCount = 0;
    const employeeRecords = [];
    
    // Process up to 100 messages
    const maxMessages = Math.min(queueInfo.messageCount, 100);
    
    for (let i = 0; i < maxMessages; i++) {
      const message = await channel.get(queueName, { noAck: false });
      
      if (!message) {
        logger.info({
          message: `No more messages to process`,
          timestamp: new Date().toISOString(),
        });
        break;
      }
      
      messageCount++;
      
      try {
        const content = JSON.parse(message.content.toString());
        
        // Check if this is an employee record
        if (content.employee_id && content.first_name && content.last_name) {
          employeeCount++;
          employeeRecords.push({
            employee_id: content.employee_id,
            employee_number: content.employee_number,
            name: `${content.first_name} ${content.last_name}`,
          });
        }
        
        // Always nack the message and requeue it so we don't remove it
        channel.nack(message, false, true);
      } catch (error) {
        logger.error({
          message: `Error parsing message: ${error.message}`,
          timestamp: new Date().toISOString(),
        });
        channel.nack(message, false, true);
      }
    }
    
    logger.info({
      message: `Checked ${messageCount} messages, found ${employeeCount} employee records`,
      timestamp: new Date().toISOString(),
    });
    
    if (employeeCount > 0) {
      logger.info({
        message: `Found ${employeeCount} employee records in queue:`,
        metadata: { employeeRecords },
        timestamp: new Date().toISOString(),
      });
    } else {
      logger.info({
        message: `No employee records found in the first ${messageCount} messages`,
        timestamp: new Date().toISOString(),
      });
    }
    
    await connection.close();
  } catch (error) {
    logger.error({
      message: `Error checking queue: ${error.message}`,
      error: error,
      timestamp: new Date().toISOString(),
    });
  }
}

// Run the function
checkQueueForEmployeeRecords().catch(err => {
  logger.error({
    message: `Unhandled error: ${err.message}`,
    error: err,
    timestamp: new Date().toISOString(),
  });
});
