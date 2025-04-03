const amqp = require("amqplib");
const { logger } = require("../utils/logger");
const validationService = require("./validationService");

class MQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.exchange = process.env.RABBITMQ_EXCHANGE || "etl_exchange";
    this.passedQueue = process.env.RABBITMQ_PASSED_QUEUE || "passed_data";
    this.failedQueue = process.env.RABBITMQ_FAILED_QUEUE || "failed_data";
  }

  async connect() {
    try {
      if (!this.connection) {
        this.connection = await amqp.connect(
          process.env.RABBITMQ_URL || "amqp://localhost"
        );
        logger.info({
          message: "Connected to RabbitMQ server",
          timestamp: new Date().toISOString(),
        });
      }

      if (!this.channel) {
        this.channel = await this.connection.createChannel();

        // Create exchange
        await this.channel.assertExchange(this.exchange, "direct", {
          durable: true,
        });

        // Create queues
        await this.channel.assertQueue(this.passedQueue, { durable: true });
        await this.channel.assertQueue(this.failedQueue, { durable: true });

        // Bind queues to exchange
        await this.channel.bindQueue(this.passedQueue, this.exchange, "passed");
        await this.channel.bindQueue(this.failedQueue, this.exchange, "failed");

        logger.info({
          message: "RabbitMQ channels and queues initialized",
          metadata: {
            exchange: this.exchange,
            queues: [this.passedQueue, this.failedQueue],
          },
          timestamp: new Date().toISOString(),
        });
      }

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

  async publishToPassed(data) {
    try {
      const channel = await this.connect();
      const success = channel.publish(
        this.exchange,
        "passed",
        Buffer.from(JSON.stringify(data)),
        { persistent: true }
      );

      // Use validationService to determine object type
      const objectType = validationService.determineObjectType(data);

      logger.info({
        message: "Published message to passed queue",
        metadata: {
          dataType: typeof data,
          objectType: objectType,
        },
        timestamp: new Date().toISOString(),
      });

      return success;
    } catch (error) {
      logger.error({
        message: "Failed to publish to passed queue",
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

  async publishToFailed(data, reason) {
    try {
      const channel = await this.connect();
      const message = {
        data,
        error: reason,
        timestamp: new Date().toISOString(),
      };

      const success = channel.publish(
        this.exchange,
        "failed",
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );

      // Use validationService to determine object type
      const objectType = validationService.determineObjectType(data);

      logger.info({
        message: "Published message to failed queue",
        metadata: {
          dataType: typeof data,
          objectType: objectType,
          reason: reason,
        },
        timestamp: new Date().toISOString(),
      });

      return success;
    } catch (error) {
      logger.error({
        message: "Failed to publish to failed queue",
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
   * Close the RabbitMQ connection
   */
  async close() {
    try {
      // Close channel if it exists and seems to be open
      if (this.channel) {
        try {
          await this.channel.close();
        } catch (channelError) {
          // Log but don't throw - channel may already be closed
          logger.warn({
            message: "Channel already closed or error while closing",
            metadata: {
              error: channelError.message,
            },
          });
        }
      }
      
      // Close connection if it exists and seems to be open
      if (this.connection) {
        try {
          await this.connection.close();
        } catch (connError) {
          // Log but don't throw - connection may already be closed
          logger.warn({
            message: "Connection already closed or error while closing",
            metadata: {
              error: connError.message,
            },
          });
        }
      }
      
      this.channel = null;
      this.connection = null;
      
      logger.info({
        message: "RabbitMQ resources released",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // This catch block should never be reached given our error handling above,
      // but keeping it as a safety measure
      logger.error({
        message: "Unexpected error during RabbitMQ cleanup",
        metadata: {
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
      });
      // Don't rethrow - we want to continue even if cleanup fails
    }
  }
}

module.exports = new MQService();
