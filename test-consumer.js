require('dotenv').config();
const consumePassedData = require('./src/services/consumePassedData');
const mqService = require('./src/services/mqService');
const { logger } = require('./src/utils/logger');

async function startConsumerTest() {
  try {
    // Start the consumer to process messages
    await consumePassedData.startConsumer();
    logger.info({
      message: 'Consumer started successfully',
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ Consumer started and is now listening for messages on the queue.');
    console.log('Press Ctrl+C to stop the consumer.');
  } catch (error) {
    logger.error({
      message: 'Failed to start consumer',
      metadata: {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    });
    console.error('❌ Failed to start consumer:', error.message);
    process.exit(1);
  }
}

// Handle application shutdown
process.on('SIGINT', async () => {
  console.log('\nStopping consumer...');
  try {
    await consumePassedData.stopConsumer();
    console.log('✅ Consumer stopped gracefully.');
  } catch (error) {
    console.error('❌ Error stopping consumer:', error.message);
  }
  process.exit(0);
});

// Start the consumer
startConsumerTest();
