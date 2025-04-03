/**
 * ETL Injection script modified for AWS Lambda compatibility
 * This script processes Excel files and injects data into the database through RabbitMQ
 */
const axios = require('axios');
const logger = require('./utils/logger');
const mqService = require('./services/mqService');
const consumePassedData = require('./services/consumePassedData');
const fs = require('fs');
const path = require('path');

/**
 * Main ETL function to be called by Lambda
 */
async function runEtl() {
  logger.info({
    message: "Starting ETL Injection process from Lambda...",
  });

  try {
    // Get the Excel file path from Lambda environment
    const excelFilePath = process.env.EXCEL_FILE_PATH;
    const organizationName = process.env.ORGANIZATION_NAME;

    if (!excelFilePath) {
      throw new Error("No Excel file path provided in environment variables");
    }

    logger.info({
      message: `Processing Excel file for organization: ${organizationName}`,
      metadata: { filePath: excelFilePath },
    });

    // Step 1: Call API to process Excel file
    logger.info({
      message: "Step 1: Calling API to process Excel file...",
    });

    // Make sure the file exists
    if (!fs.existsSync(excelFilePath)) {
      throw new Error(`Excel file not found at path: ${excelFilePath}`);
    }

    // Call API to process Excel file
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8085';
    const apiResponse = await axios.post(
      `${apiBaseUrl}/api/v1/tenant-onboarding/process-excel`,
      { filePath: excelFilePath, organizationName },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (apiResponse.status !== 200) {
      throw new Error(`API returned error status: ${apiResponse.status}`);
    }

    logger.info({
      message: "Excel processing completed successfully",
    });

    // Step 2: Run data transformation
    logger.info({
      message: "Step 2: Running data transformation...",
    });

    // Import and run the ETL service
    const etlService = require('./services/etlService');
    await etlService.runEtl(excelFilePath);

    logger.info({
      message: "Data validation and queue loading completed successfully",
    });

    // Step 3: Check and process queues
    logger.info({
      message: "Step 3: Checking and processing queues...",
    });

    await checkAndProcessQueues();

    logger.info({
      message: "ETL Injection process completed successfully!",
    });

    return {
      success: true,
      message: "ETL process completed successfully"
    };
  } catch (error) {
    logger.error({
      message: "ETL process failed",
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
 * Checks the status of RabbitMQ queues and processes them according to business rules
 */
async function checkAndProcessQueues() {
  let connection = null;
  let channel = null;

  try {
    // Initialize MQ Service
    await mqService.connect();
    connection = mqService.connection;
    channel = mqService.channel;

    logger.info({
      message: "Connected to RabbitMQ server",
    });

    logger.info({
      message: "RabbitMQ channels and queues initialized",
      metadata: {
        exchange: mqService.exchange,
        queues: [mqService.passedQueue, mqService.failedQueue],
      },
    });

    // Check message counts in both queues
    const passedQueueInfo = await channel.checkQueue(mqService.passedQueue);
    const failedQueueInfo = await channel.checkQueue(mqService.failedQueue);

    const passedMessageCount = passedQueueInfo.messageCount;
    const failedMessageCount = failedQueueInfo.messageCount;

    logger.info({
      message: "Queue status",
      metadata: {
        passedQueue: {
          name: mqService.passedQueue,
          messageCount: passedMessageCount,
        },
        failedQueue: {
          name: mqService.failedQueue,
          messageCount: failedMessageCount,
        },
      },
    });

    // RULE 1: If there are messages in the failed queue, process only them
    // and clear the passed queue without processing
    if (failedMessageCount > 0) {
      logger.warn({
        message: `Found ${failedMessageCount} messages in the failed queue. Processing ONLY failed messages...`,
      });

      // Process failed messages first
      await consumeFailedMessages(channel);

      logger.info({
        message: "Successfully processed all messages from the failed queue.",
      });

      // If there are passed messages, clear them without processing
      if (passedMessageCount > 0) {
        logger.info({
          message: `Found ${passedMessageCount} messages in the passed queue. Clearing the passed queue without processing...`,
          metadata: {
            reason: "Rule: Clear passed queue when failed queue has messages",
          },
        });

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
      
      // Run the consumer to process passed data
      await processPassedData();

      logger.info("All data has been successfully inserted into the database.");
    } else if (passedMessageCount === 0 && failedMessageCount === 0) {
      logger.info("Both queues are empty. Nothing to process.");
    } else {
      logger.warn(
        "Unexpected queue state. This should not happen with the current rules."
      );
    }
  } catch (error) {
    logger.error({
      message: "Error processing queues",
      metadata: {
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
    });
    throw error;
  } finally {
    // Clean up MQ resources
    try {
      await mqService.close();
      logger.info({
        message: "RabbitMQ resources released",
      });
    } catch (err) {
      logger.warn({
        message: "Error cleaning up MQ resources",
        metadata: { error: err.message },
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
    try {
      // Count of consumed messages
      let consumedCount = 0;
      // Consumer tag to identify the consumer for cancellation
      let consumerTag = null;

      logger.info("Starting to consume messages from the failed_data queue...");

      // Start consuming messages from the failed queue
      channel.consume(
        mqService.failedQueue,
        (msg) => {
          if (!msg) {
            logger.warn("Received empty message from failed_data queue");
            return;
          }

          try {
            // Parse the message content
            const content = JSON.parse(msg.content.toString());

            // Log the failed message for debugging/auditing purposes
            logger.error({
              message: "Failed data message",
              metadata: content,
            });

            // Acknowledge the message (remove it from the queue)
            channel.ack(msg);

            // Track progress
            consumedCount++;

            // Check if queue is empty and end consumption when done
            channel.checkQueue(mqService.failedQueue).then((queueInfo) => {
              if (queueInfo.messageCount === 0) {
                logger.info("Failed queue is now empty. Stopping consumer...");
                
                // Cancel the consumer
                if (consumerTag) {
                  channel.cancel(consumerTag).then(() => {
                    logger.info("Failed queue consumer canceled");
                    resolve(consumedCount);
                  }).catch(cancelError => {
                    logger.warn({
                      message: "Error canceling failed queue consumer",
                      metadata: { error: cancelError.message }
                    });
                    // Still resolve as we've processed all messages
                    resolve(consumedCount);
                  });
                } else {
                  resolve(consumedCount);
                }
              }
            }).catch(checkError => {
              logger.error({
                message: "Error checking failed queue status",
                metadata: { error: checkError.message }
              });
              // Continue processing despite the error
            });

          } catch (parseError) {
            logger.error({
              message: "Error parsing failed message",
              metadata: {
                error: parseError.message,
                rawContent: msg.content.toString()
              }
            });
            // Still acknowledge the message to remove it from the queue
            channel.ack(msg);
          }
        },
        { noAck: false }
      ).then(consumer => {
        consumerTag = consumer.consumerTag;
        logger.info(`Started consuming messages from failed_data queue with consumer tag: ${consumerTag}`);
      }).catch(error => {
        logger.error({
          message: "Failed to start consumer for failed_data queue",
          metadata: { error: error.message }
        });
        reject(error);
      });

      // Set a safety timeout after 5 minutes
      setTimeout(() => {
        if (consumerTag) {
          channel.cancel(consumerTag).catch(() => {});
        }
        logger.warn({
          message: "Timeout reached while processing failed_data queue",
          metadata: { consumedCount }
        });
        resolve(consumedCount);
      }, 5 * 60 * 1000);

    } catch (error) {
      logger.error({
        message: "Error consuming failed_data queue",
        metadata: { error: error.message }
      });
      reject(error);
    }
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

// Export the ETL function for Lambda compatibility
exports.runEtl = runEtl;
