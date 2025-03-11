#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const dataConsumerService = require('../services/consumePassedData');
const { logger } = require('../utils/logger');

/**
 * Main function to start the consumer
 */
async function main() {
  try {
    logger.info({
      message: 'Starting data consumer service...',
      timestamp: new Date().toISOString(),
    });

    // Start the consumer
    await dataConsumerService.startConsumer();

    logger.info({
      message: 'Data consumer service started successfully',
      timestamp: new Date().toISOString(),
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info({
        message: 'Received SIGINT. Shutting down consumer...',
        timestamp: new Date().toISOString(),
      });
      await dataConsumerService.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info({
        message: 'Received SIGTERM. Shutting down consumer...',
        timestamp: new Date().toISOString(),
      });
      await dataConsumerService.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error({
      message: 'Failed to start data consumer service',
      metadata: {
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
      timestamp: new Date().toISOString(),
    });
    process.exit(1);
  }
}

// Run the main function
main();
