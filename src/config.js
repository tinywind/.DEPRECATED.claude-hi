/**
 * Configuration management for Claude Hi service
 */

const path = require('path');

class Config {
  constructor() {
    this.loadConfig();
    this.validateConfig();
  }

  loadConfig() {
    // Test mode settings first
    const isTestMode = process.env.NODE_ENV === 'test';
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Default configuration
    this.config = {
      // Messaging settings
      interval: parseInt(process.env.HI_INTERVAL) || 600000, // 10 minutes in milliseconds
      message: process.env.HI_MESSAGE || 'hi',

      // Output settings
      outputMode: process.env.OUTPUT_MODE || 'console', // 'console', 'claude', or 'file'
      outputFile: process.env.OUTPUT_FILE || null, // optional file path for file mode

      // Retry settings
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
      retryDelay: parseInt(process.env.RETRY_DELAY) || 5000, // 5 seconds

      // Development settings
      isDevelopment: isDevelopment,
      logLevel: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

      // Test mode settings
      isTestMode: isTestMode,
      testInterval: 5000, // 5 seconds for testing
    };

    // Override with shorter interval in development
    if (this.config.isDevelopment && !isTestMode) {
      this.config.interval = parseInt(process.env.DEV_INTERVAL) || 30000; // 30 seconds for development
    }

    // Override with even shorter interval in test mode
    if (this.config.isTestMode) {
      this.config.interval = parseInt(process.env.HI_INTERVAL) || this.config.testInterval;
    }
  }

  validateConfig() {
    // No required fields for console output mode

    // Validate interval
    if (this.config.interval < 1000) {
      throw new Error('Interval must be at least 1000ms (1 second)');
    }

    // Validate retry settings
    if (this.config.retryAttempts < 0 || this.config.retryAttempts > 10) {
      throw new Error('Retry attempts must be between 0 and 10');
    }

    if (this.config.retryDelay < 1000 || this.config.retryDelay > 60000) {
      throw new Error('Retry delay must be between 1000ms and 60000ms');
    }
  }

  get(key) {
    return this.config[key];
  }

  set(key, value) {
    this.config[key] = value;
    this.validateConfig();
  }

  getAll() {
    return { ...this.config };
  }

  // Get formatted interval for display
  getFormattedInterval() {
    const minutes = Math.floor(this.config.interval / 60000);
    const seconds = Math.floor((this.config.interval % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  // Check if running in development mode
  isDev() {
    return this.config.isDevelopment;
  }

  // Check if running in test mode
  isTest() {
    return this.config.isTestMode;
  }
}

// Export singleton instance
module.exports = new Config();