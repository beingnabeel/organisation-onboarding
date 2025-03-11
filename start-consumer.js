require('dotenv').config();
const consumePassedData = require('./src/services/consumePassedData');
const { logger } = require('./src/utils/logger');

async function startConsumer() {
  try {
    logger.info('Starting consumer service...');
    
    // Start consuming messages
    await consumePassedData.startConsumer();
    
    logger.info('Consumer service started successfully');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down consumer...');
      try {
        await consumePassedData.close();
        logger.info('Consumer shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({
          message: 'Error during consumer shutdown',
          metadata: {
            error: {
              message: err.message,
              stack: err.stack
            }
          }
        });
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error({
      message: 'Failed to start consumer service',
      metadata: {
        error: {
          message: error.message,
          stack: error.stack
        }
      }
    });
    process.exit(1);
  }
}

startConsumer();
