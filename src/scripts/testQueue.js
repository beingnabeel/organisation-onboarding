require("dotenv").config();
const etlService = require("../services/etlService");
const { logger } = require("../utils/logger");

async function testQueue() {
  try {
    logger.info("Starting ETL load test...");

    const stats = await etlService.loadData();

    logger.info("ETL load test completed successfully");
    logger.info({
      message: "ETL Statistics",
      metadata: stats,
    });

    process.exit(0);
  } catch (error) {
    logger.error({
      message: "ETL load test failed",
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

testQueue();
