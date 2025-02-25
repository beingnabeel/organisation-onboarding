const cors = require("cors");
const express = require("express");
const winston = require("winston");
const AppError = require("./src/utils/appError");
const globalErrorHandler = require("./src/controllers/errorController");
const { requestLogger, errorLogger } = require("./src/utils/logger");

const app = express();

const corsOptions = {
  origin: "http://localhost:8085",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(errorLogger);

// Routes
const tenantOnboardingRoutes = require('./src/routes/tenantOnboardingRoutes');
app.use('/api/v1/tenant-onboarding', tenantOnboardingRoutes);

// Handle unhandled routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});
app.use(globalErrorHandler);

module.exports = app;
