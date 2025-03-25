require("dotenv").config();
const amqp = require("amqplib");
const fs = require("fs").promises;
const path = require("path");
const { logger } = require("../utils/logger");

/**
 * A class to handle consumption of messages from RabbitMQ queues
 * and writing them to JSON files
 */
class QueueConsumer {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost";
    this.passedQueue = process.env.RABBITMQ_PASSED_QUEUE || "passed_data";
    this.failedQueue = process.env.RABBITMQ_FAILED_QUEUE || "failed_data";
    this.passedData = [];
    this.failedData = [];
  }

  /**
   * Connect to RabbitMQ server
   */
  async connect() {
    try {
      this.connection = await amqp.connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Make sure queues exist
      await this.channel.assertQueue(this.passedQueue, { durable: true });
      await this.channel.assertQueue(this.failedQueue, { durable: true });

      logger.info({
        message: "Connected to RabbitMQ",
        timestamp: new Date().toISOString(),
      });

      return this.channel;
    } catch (error) {
      logger.error({
        message: "Failed to connect to RabbitMQ",
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Consume messages from both queues
   * @param {number} maxMessages - Maximum number of messages to consume (0 for all available)
   */
  async consumeQueues(maxMessages = 0) {
    try {
      const channel = await this.connect();
      const startTime = Date.now();
      let passedCount = 0;
      let failedCount = 0;

      // Setup counts object to track consumption
      const counts = {
        passed: 0,
        failed: 0,
      };

      // Process passed data queue
      logger.info({
        message: "Starting to consume from passed_data queue",
        timestamp: new Date().toISOString(),
      });

      await this.consumeQueue(
        channel,
        this.passedQueue,
        this.passedData,
        counts,
        "passed",
        maxMessages
      );

      // Process failed data queue
      logger.info({
        message: "Starting to consume from failed_data queue",
        timestamp: new Date().toISOString(),
      });

      await this.consumeQueue(
        channel,
        this.failedQueue,
        this.failedData,
        counts,
        "failed",
        maxMessages
      );

      // Write data to files
      // Explicitly set the absolute path to your project directory
      const projectRoot = "/home/nabeel/Documents/AIDIPH/tenant_onboarding";
      const passedFilePath = path.join(projectRoot, "passed_data.json");
      const failedFilePath = path.join(projectRoot, "failed_data.json");

      // Debug logs to see what paths we're using
      console.log(`Debug - Using project root: ${projectRoot}`);
      console.log(`Debug - Will write to: ${passedFilePath}`);
      console.log(`Debug - Will write to: ${failedFilePath}`);

      // Check if directory exists
      try {
        const stats = await fs.stat(projectRoot);
        if (!stats.isDirectory()) {
          throw new Error(`Project root is not a directory: ${projectRoot}`);
        }
        console.log(`Debug - Project directory exists and is valid`);
      } catch (error) {
        console.error(`Error with project directory: ${error.message}`);
        throw error;
      }

      await fs.writeFile(
        passedFilePath,
        JSON.stringify(this.passedData, null, 2)
      );
      await fs.writeFile(
        failedFilePath,
        JSON.stringify(this.failedData, null, 2)
      );

      logger.info({
        message: "Data consumption completed",
        metadata: {
          stats: {
            passedMessages: counts.passed,
            failedMessages: counts.failed,
            totalMessages: counts.passed + counts.failed,
            passedFilePath,
            failedFilePath,
            executionTimeMs: Date.now() - startTime,
          },
        },
        timestamp: new Date().toISOString(),
      });

      return {
        passedMessages: counts.passed,
        failedMessages: counts.failed,
        totalMessages: counts.passed + counts.failed,
        passedFilePath,
        failedFilePath,
      };
    } catch (error) {
      logger.error({
        message: "Error consuming queues",
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
        timestamp: new Date().toISOString(),
      });
      throw error;
    } finally {
      await this.close();
    }
  }

  /**
   * Consume messages from a specific queue
   * @param {Object} channel - RabbitMQ channel
   * @param {string} queueName - Name of the queue to consume from
   * @param {Array} dataArray - Array to store consumed messages
   * @param {Object} counts - Object to track message counts
   * @param {string} countKey - Key in counts object to increment
   * @param {number} maxMessages - Maximum number of messages to consume
   */
  async consumeQueue(
    channel,
    queueName,
    dataArray,
    counts,
    countKey,
    maxMessages
  ) {
    return new Promise((resolve, reject) => {
      // Check if queue is empty
      channel
        .checkQueue(queueName)
        .then((queueInfo) => {
          if (queueInfo.messageCount === 0) {
            logger.info({
              message: `Queue ${queueName} is empty`,
              timestamp: new Date().toISOString(),
            });
            return resolve();
          }

          // Set max messages limit or consume all if maxMessages is 0
          const messagesToConsume =
            maxMessages > 0
              ? Math.min(maxMessages, queueInfo.messageCount)
              : queueInfo.messageCount;

          logger.info({
            message: `Found ${queueInfo.messageCount} messages in ${queueName} queue`,
            timestamp: new Date().toISOString(),
          });

          let messageCount = 0;
          let consumerTag;

          // Create a function to check if we've consumed all messages
          const checkComplete = () => {
            if (messageCount >= messagesToConsume) {
              if (consumerTag) {
                channel
                  .cancel(consumerTag)
                  .then(() => {
                    logger.info({
                      message: `Completed consuming ${messageCount} messages from ${queueName}`,
                      timestamp: new Date().toISOString(),
                    });
                    resolve();
                  })
                  .catch(reject);
              } else {
                resolve();
              }
            }
          };

          // Start consuming
          channel
            .consume(
              queueName,
              (msg) => {
                if (msg) {
                  try {
                    const content = JSON.parse(msg.content.toString());
                    dataArray.push(content);
                    counts[countKey]++;
                    messageCount++;

                    // Acknowledge the message
                    channel.ack(msg);

                    // Log every 10 messages
                    if (messageCount % 10 === 0) {
                      logger.info({
                        message: `Consumed ${messageCount} messages from ${queueName}`,
                        timestamp: new Date().toISOString(),
                      });
                    }

                    // Check if we've reached the consumption limit
                    checkComplete();
                  } catch (error) {
                    logger.error({
                      message: `Error processing message from ${queueName}`,
                      metadata: {
                        error: {
                          message: error.message,
                          stack: error.stack,
                        },
                      },
                      timestamp: new Date().toISOString(),
                    });
                    channel.nack(msg, false, false); // Reject the message and don't requeue
                  }
                }
              },
              { noAck: false }
            )
            .then((consumer) => {
              consumerTag = consumer.consumerTag;
              // Handle the case where we don't get any messages (queue is empty)
              if (messageCount === 0) {
                channel
                  .cancel(consumerTag)
                  .then(() => {
                    logger.info({
                      message: `No messages in ${queueName} to consume`,
                      timestamp: new Date().toISOString(),
                    });
                    resolve();
                  })
                  .catch(reject);
              }
            })
            .catch(reject);
        })
        .catch(reject);
    });
  }

  /**
   * Close RabbitMQ connection
   */
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      logger.info({
        message: "Closed RabbitMQ connection",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({
        message: "Error closing RabbitMQ connection",
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}

async function main() {
  try {
    const consumer = new QueueConsumer();
    const result = await consumer.consumeQueues();

    console.log("Queue consumption completed successfully!");
    console.log(
      `Consumed ${result.passedMessages} passed messages and ${result.failedMessages} failed messages`
    );
    console.log(
      `Data written to: \n - ${result.passedFilePath}\n - ${result.failedFilePath}`
    );

    process.exit(0);
  } catch (error) {
    console.error("Error consuming queues:", error.message);
    process.exit(1);
  }
}

// Run the script
main();
