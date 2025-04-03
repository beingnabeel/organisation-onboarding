require("dotenv").config();
const axios = require("axios");
const { execSync } = require("child_process");
const path = require("path");
const { logger } = require("../utils/logger");
const mqService = require("../services/mqService");
const consumePassedData = require("../services/consumePassedData");

/**
 * Main ETL injection script that orchestrates the entire data pipeline:
 * 1. Extracts data from Excel via API
 * 2. Transforms data by running testEtl.js
 * 3. Validates and loads data to queues by running testQueue.js
 * 4. Consumes data from queues and inserts into database
 */
async function etlInjestion() {
  try {
    logger.info("Starting ETL Injection process...");

    // Step 1: Call API to process Excel file
    logger.info("Step 1: Calling API to process Excel file...");
    const extractResponse = await axios.post(
      "http://localhost:8085/api/v1/tenant-onboarding/process-excel"
    );

    if (extractResponse.status !== 200) {
      throw new Error(`Excel processing failed: ${extractResponse.statusText}`);
    }
    logger.info("Excel processing completed successfully");

    // Step 2: Run testEtl.js to transform data
    logger.info("Step 2: Running data transformation...");
    const testEtlPath = path.resolve(__dirname, "testEtl.js");
    execSync(`node ${testEtlPath}`, { stdio: "inherit" });
    logger.info("Data transformation completed successfully");

    // Step 3: Run testQueue.js to validate and load data to queues
    logger.info("Step 3: Validating and loading data to queues...");
    const testQueuePath = path.resolve(__dirname, "testQueue.js");
    execSync(`node ${testQueuePath}`, { stdio: "inherit" });
    logger.info("Data validation and queue loading completed successfully");

    // Step 4: Check and process queues
    logger.info("Step 4: Checking and processing queues...");
    await checkAndProcessQueues();

    logger.info("ETL Injection process completed successfully!");
    process.exit(0);
  } catch (error) {
    logger.error({
      message: "ETL Injection process failed",
      metadata: {
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
    });
    process.exit(1);
  }
}

/**
 * Checks queue contents and processes them according to these rules:
 * 1. If failed_data queue has messages:
 *    - Consume and log the failed messages only, DO NOT process passed_data
 * 2. Only if failed_data is EMPTY and passed_data has messages:
 *    - Start the consumer to process passed_data
 */
async function checkAndProcessQueues() {
  let channel = null;
  try {
    // Connect to RabbitMQ
    channel = await mqService.connect();

    // Check the failed_data queue
    const failedQueueInfo = await channel.assertQueue(mqService.failedQueue, {
      durable: true,
    });
    const failedMessageCount = failedQueueInfo.messageCount;

    // Check the passed_data queue
    const passedQueueInfo = await channel.assertQueue(mqService.passedQueue, {
      durable: true,
    });
    const passedMessageCount = passedQueueInfo.messageCount;

    logger.info({
      message: "Queue status",
      metadata: {
        failedQueue: {
          name: mqService.failedQueue,
          messageCount: failedMessageCount,
        },
        passedQueue: {
          name: mqService.passedQueue,
          messageCount: passedMessageCount,
        },
      },
    });

    // RULE 1: If failed queue has messages, ONLY consume and log them
    // DO NOT process passed data when failed queue has messages
    if (failedMessageCount > 0) {
      logger.warn({
        message: `Found ${failedMessageCount} messages in the failed queue. Processing ONLY failed messages...`,
      });

      // Note: Don't close the channel before or during consumeFailedMessages
      await consumeFailedMessages(channel);
      
      // After processing failed messages, recheck failed queue
      const recheckFailedQueue = await channel.assertQueue(mqService.failedQueue, {
        durable: true,
      });
      const remainingFailedMessages = recheckFailedQueue.messageCount;
      
      if (remainingFailedMessages > 0) {
        logger.warn({
          message: `Still have ${remainingFailedMessages} messages in the failed queue after processing.`,
        });
      } else {
        logger.info({
          message: `Successfully processed all messages from the failed queue.`,
        });
      }
      
      // If there are messages in the passed_data queue, we need to clear them out (consume without processing)
      if (passedMessageCount > 0) {
        logger.info({
          message: `Found ${passedMessageCount} messages in the passed queue. Clearing the passed queue without processing...`,
          metadata: {
            reason: "Rule: Clear passed queue when failed queue has messages"
          }
        });
        
        // Consume and empty the passed_data queue without processing
        await consumeAndEmptyPassedQueue(channel);
        
        logger.info({
          message: `Successfully cleared ${passedMessageCount} messages from the passed queue.`,
        });
      }
      
      // Return early - DO NOT process passed data in the same run as failed data
      return;
    }

    // RULE 2: Only if failed queue is EMPTY and passed queue has messages, process passed data
    if (passedMessageCount > 0 && failedMessageCount === 0) {
      logger.info({
        message: `Found ${passedMessageCount} messages in the passed queue and NO messages in failed queue. Starting consumer...`,
      });

      // Close the channel before starting the consumer process
      // since the consumer will establish its own connection
      if (channel) {
        await channel.close();
        channel = null;
      }
      
      // Run the consumer to process passed data by starting the consumer service
      await processPassedData();

      logger.info("All data has been successfully inserted into the database.");
    } else if (passedMessageCount === 0 && failedMessageCount === 0) {
      logger.info("Both queues are empty. Nothing to process.");
    } else {
      // This case should not be reached given our logic above, but keeping as a safeguard
      logger.warn(
        "Cannot process passed data because there are messages in the failed queue. " +
          "Please fix the issues with failed data and try again."
      );
    }
  } catch (error) {
    logger.error({
      message: "Error checking and processing queues",
      metadata: {
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
    });
    throw error;
  } finally {
    // Ensure connection is closed properly, but only if we haven't already closed the channel
    if (channel) {
      try {
        await channel.close();
      } catch (closeError) {
        // Ignore close errors, as the channel might already be closed
        logger.warn({
          message: "Warning when closing channel",
          metadata: {
            error: closeError.message,
          }
        });
      }
    }
    
    // Close the MQ service connection
    try {
      await mqService.close();
    } catch (closeError) {
      logger.warn({
        message: "Warning when closing MQ connection",
        metadata: {
          error: closeError.message,
        }
      });
    }
  }
}

/**
 * Consumes and empties the passed_data queue without processing messages using purge method
 * @param {Object} channel - RabbitMQ channel
 */
async function consumeAndEmptyPassedQueue(channel) {
  try {
    logger.info({
      message: "Purging all messages from the passed_data queue...",
    });
    
    // First, get the current message count to know how many messages we're purging
    const queueInfo = await channel.checkQueue(mqService.passedQueue);
    const messageCount = queueInfo.messageCount;
    
    // Use the purgeQueue method which is more reliable than consuming messages one by one
    // This instantly removes all messages from the queue
    const result = await channel.purgeQueue(mqService.passedQueue);
    
    logger.info({
      message: `Successfully purged ${result.messageCount} messages from the passed_data queue`,
    });
    
    return result.messageCount;
  } catch (error) {
    logger.error({
      message: "Error purging passed_data queue",
      metadata: {
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
    });
    throw error;
  }
}

/**
 * Consumes and logs messages from the failed_data queue
 * @param {Object} channel - RabbitMQ channel
 */
async function consumeFailedMessages(channel) {
  return new Promise((resolve, reject) => {
    let processedCount = 0;
    let consumerTag;

    // Set up consumer with a tag we can reference later
    channel.consume(
      mqService.failedQueue,
      (msg) => {
        if (msg !== null) {
          try {
            const content = JSON.parse(msg.content.toString());

            logger.error({
              message: "Failed data message",
              metadata: {
                data: content.data,
                error: content.error,
                timestamp: content.timestamp,
              },
            });

            channel.ack(msg);
            processedCount++;
          } catch (error) {
            logger.error({
              message: "Error processing failed message",
              metadata: {
                error: {
                  message: error.message,
                  stack: error.stack,
                },
              },
            });
            channel.nack(msg, false, false); // Don't requeue
          }
        }
      },
      { noAck: false, consumerTag: 'failed-queue-consumer' }
    ).then(consumeInfo => {
      consumerTag = consumeInfo.consumerTag;
    });

    // Check every second if all messages are processed
    const interval = setInterval(async () => {
      try {
        const queueInfo = await channel.assertQueue(mqService.failedQueue, {
          durable: true,
        });
        if (queueInfo.messageCount === 0) {
          clearInterval(interval);
          logger.info(`Successfully processed ${processedCount} failed messages`);
          
          // Cancel consumer properly
          if (consumerTag) {
            await channel.cancel(consumerTag);
          }
          
          resolve();
        }
      } catch (err) {
        clearInterval(interval);
        logger.error({
          message: "Error checking queue in interval",
          metadata: {
            error: {
              message: err.message,
              stack: err.stack,
            },
          },
        });
        reject(err);
      }
    }, 1000);

    // Safety timeout after 5 minutes
    setTimeout(
      () => {
        clearInterval(interval);
        const error = new Error(`Timeout waiting for failed queue processing`);
        reject(error);
      },
      5 * 60 * 1000
    );
  });
}

/**
 * Processes messages from the passed_data queue by running the consumer
 * Ensures that all messages are processed before closing the connection
 */
async function processPassedData() {
  return new Promise((resolve, reject) => {
    try {
      // Keep track of consecutive empty queue checks for more reliable emptiness detection
      let emptyQueueChecks = 0;
      const requiredEmptyChecks = 3; // Require multiple empty checks to confirm queue is truly empty
      let lastMessageCount = -1;
      
      logger.info({
        message: "Starting consumer for passed_data queue processing",
        metadata: { timestamp: new Date().toISOString() }
      });
      
      // Start the consumer
      consumePassedData.startConsumer();

      // Set up interval to check if queue is empty
      const checkQueueInterval = setInterval(async () => {
        let connection = null;
        let channel = null;
        try {
          // Create a completely new connection for each check
          // This avoids issues with potentially closed channels from mqService
          connection = await require('amqplib').connect(
            process.env.RABBITMQ_URL || "amqp://localhost"
          );
          channel = await connection.createChannel();
          
          // Get queue names from environment or use defaults
          const passedQueue = process.env.RABBITMQ_PASSED_QUEUE || "passed_data";
          
          const queueInfo = await channel.assertQueue(passedQueue, {
            durable: true,
          });

          const currentMessageCount = queueInfo.messageCount;
          
          // Only log if the count has changed to avoid excessive logging
          if (currentMessageCount !== lastMessageCount) {
            logger.info({
              message: `Queue check: ${currentMessageCount} messages remaining in passed_data queue`,
              metadata: { timestamp: new Date().toISOString() }
            });
            lastMessageCount = currentMessageCount;
          }

          if (currentMessageCount === 0) {
            // Count consecutive empty checks for more reliable determination
            emptyQueueChecks++;
            
            if (emptyQueueChecks >= requiredEmptyChecks) {
              // We've confirmed the queue is truly empty with multiple checks
              logger.info({
                message: `Queue confirmed empty after ${requiredEmptyChecks} consecutive zero-message checks`,
                metadata: { timestamp: new Date().toISOString() }
              });
              
              // All messages processed, clean up and resolve
              clearInterval(checkQueueInterval);
              
              // Close the resources we just opened for checking
              if (channel) {
                try {
                  await channel.close();
                } catch (closeError) {
                  logger.warn({
                    message: "Warning closing check channel",
                    metadata: { error: closeError.message }
                  });
                }
              }
              
              if (connection) {
                try {
                  await connection.close();
                } catch (closeError) {
                  logger.warn({
                    message: "Warning closing check connection",
                    metadata: { error: closeError.message }
                  });
                }
              }
              
              // Close the consumer connection and resolve
              logger.info({
                message: "All messages processed. Closing consumer connection",
                metadata: { timestamp: new Date().toISOString() }
              });
              
              await consumePassedData.close();
              
              logger.info({
                message: "Consumer connection closed successfully",
                metadata: { timestamp: new Date().toISOString() }
              });
              
              resolve();
              return;
            }
          } else {
            // Reset consecutive empty checks counter since we found messages
            emptyQueueChecks = 0;
          }
          
          // Clean up resources after each check
          if (channel) {
            try {
              await channel.close();
            } catch (closeError) {
              logger.warn({
                message: "Warning closing check channel",
                metadata: { error: closeError.message }
              });
            }
            channel = null;
          }
          
          if (connection) {
            try {
              await connection.close();
            } catch (closeError) {
              logger.warn({
                message: "Warning closing check connection",
                metadata: { error: closeError.message }
              });
            }
            connection = null;
          }
        } catch (error) {
          logger.error({
            message: "Error checking passed_data queue",
            metadata: {
              error: {
                message: error.message,
                stack: error.stack,
              },
            },
          });
          
          // Always clean up resources, even on errors
          if (channel) {
            try {
              await channel.close();
            } catch (closeError) {
              // Just log, don't throw further errors
              logger.warn({
                message: "Error closing check channel",
                metadata: { error: closeError.message }
              });
            }
            channel = null;
          }
          
          if (connection) {
            try {
              await connection.close();
            } catch (closeError) {
              // Just log, don't throw further errors
              logger.warn({
                message: "Error closing check connection",
                metadata: { error: closeError.message }
              });
            }
            connection = null;
          }
          
          // Only clear interval and resolve on repeated or severe errors
          // This makes the check more resilient to temporary network issues
          if (error.message.includes("Channel ended") || 
              error.message.includes("Connection closed") ||
              error.message.includes("Socket closed") ||
              error.message.includes("Channel closed")) {
            // Count the consecutive errors, after 5 we'll stop trying
            if (!this.checkErrorCount) this.checkErrorCount = 0;
            this.checkErrorCount++;
            
            if (this.checkErrorCount >= 5) {
              logger.warn({
                message: `Stopping queue check after ${this.checkErrorCount} consecutive connection errors`,
                metadata: { 
                  lastError: error.message,
                  timestamp: new Date().toISOString() 
                }
              });
              
              clearInterval(checkQueueInterval);
              
              try {
                logger.info({
                  message: "Closing consumer after connection errors",
                  metadata: { timestamp: new Date().toISOString() }
                });
                
                await consumePassedData.close();
                
                logger.info({
                  message: "Successfully closed consumer after connection errors",
                  metadata: { timestamp: new Date().toISOString() }
                });
              } catch (err) {
                logger.error({
                  message: "Error closing consumer after connection errors",
                  metadata: { error: err.message }
                });
              }
              
              // Resolve instead of reject since we've made a best effort
              // to process all messages and the consumer service is designed
              // to acknowledge only processed messages
              resolve();
            }
          } else {
            // Reset the error count for non-connection errors
            this.checkErrorCount = 0;
          }
        }
      }, 2000); // Check every 2 seconds for more responsive queue emptiness detection

      // Safety timeout after 60 minutes (increased from 30 to ensure long-running processes complete)
      setTimeout(
        () => {
          clearInterval(checkQueueInterval);
          
          logger.warn({
            message: "Timeout reached waiting for passed queue processing",
            metadata: { 
              timeoutMinutes: 60,
              timestamp: new Date().toISOString() 
            }
          });
          
          consumePassedData.close().catch(err => {
            logger.error({
              message: "Error closing consumer after timeout",
              metadata: { error: err.message }
            });
          });
          
          // We don't want to reject here as it could be that some messages were processed
          // and we don't want to interrupt the flow. Instead, resolve with a warning.
          logger.warn({
            message: "Resolving ETL process despite timeout - some messages may remain unprocessed",
            metadata: { timestamp: new Date().toISOString() }
          });
          resolve();
        },
        60 * 60 * 1000
      );
    } catch (error) {
      logger.error({
        message: "Error starting consumer process",
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
      });
      reject(error);
    }
  });
}

// Run the ETL injection process
etlInjestion();
