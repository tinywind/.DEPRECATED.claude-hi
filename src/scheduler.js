/**
 * Scheduler for periodic message sending with drift correction
 */

const config = require('./config');

class MessageScheduler {
  constructor(messenger) {
    this.messenger = messenger;
    this.isRunning = false;
    this.timer = null;
    this.startTime = null;
    this.expectedExecutions = 0;
    this.actualExecutions = 0;
    this.lastExecutionTime = null;
  }

  async start() {
    if (this.isRunning) {
      this.log('warn', 'Scheduler is already running');
      return;
    }

    try {
      this.log('info', `Starting scheduler with ${config.getFormattedInterval()} interval`);

      // Initialize timing
      this.startTime = Date.now();
      this.expectedExecutions = 0;
      this.actualExecutions = 0;
      this.isRunning = true;

      // Send first message immediately
      await this.executeMessage();

      // Schedule subsequent messages
      this.scheduleNext();

      this.log('info', 'Scheduler started successfully');

    } catch (error) {
      this.log('error', `Failed to start scheduler: ${error.message}`);
      this.isRunning = false;
      throw error;
    }
  }

  stop() {
    if (!this.isRunning) {
      this.log('warn', 'Scheduler is not running');
      return;
    }

    this.log('info', 'Stopping scheduler...');

    this.isRunning = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const stats = this.getStats();
    this.log('info', `Scheduler stopped. Sent ${stats.actualExecutions} messages over ${stats.runtime}ms`);
  }

  scheduleNext() {
    if (!this.isRunning) {
      return;
    }

    // Calculate next execution time with drift correction
    const interval = config.get('interval');
    const now = Date.now();
    const elapsed = now - this.startTime;

    // Calculate when the next execution should happen
    this.expectedExecutions++;
    const nextExpectedTime = this.startTime + (this.expectedExecutions * interval);
    const delay = Math.max(0, nextExpectedTime - now);

    // Log drift information in debug mode
    const drift = now - (this.startTime + ((this.expectedExecutions - 1) * interval));
    if (config.get('logLevel') === 'debug' && this.actualExecutions > 0) {
      this.log('debug', `Drift: ${drift}ms, Next delay: ${delay}ms`);
    }

    this.timer = setTimeout(async () => {
      await this.executeMessage();
      this.scheduleNext();
    }, delay);

    this.log('debug', `Next message scheduled in ${delay}ms`);
  }

  async executeMessage() {
    if (!this.isRunning) {
      return;
    }

    const executionStart = Date.now();

    try {
      this.log('debug', 'Executing scheduled message send...');

      const result = await this.messenger.sendMessageWithRetry();

      this.actualExecutions++;
      this.lastExecutionTime = Date.now();

      const executionTime = this.lastExecutionTime - executionStart;
      this.log('info', `Message #${this.actualExecutions} sent successfully (took ${executionTime}ms)`);

      return result;

    } catch (error) {
      this.log('error', `Scheduled message execution failed: ${error.message}`);

      // In production, we might want to continue despite failures
      if (!config.isTest()) {
        this.log('warn', 'Continuing scheduler despite message failure');
      } else {
        // In test mode, we might want to stop on failure
        throw error;
      }
    }
  }

  getStats() {
    const now = Date.now();
    const runtime = this.startTime ? now - this.startTime : 0;
    const interval = config.get('interval');

    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      runtime,
      expectedExecutions: this.expectedExecutions,
      actualExecutions: this.actualExecutions,
      lastExecutionTime: this.lastExecutionTime,
      interval,
      intervalFormatted: config.getFormattedInterval(),
      averageInterval: this.actualExecutions > 1 ? runtime / (this.actualExecutions - 1) : null,
      successRate: this.expectedExecutions > 0 ? (this.actualExecutions / this.expectedExecutions) * 100 : 0
    };
  }

  getHealthCheck() {
    const stats = this.getStats();
    const now = Date.now();
    const interval = config.get('interval');

    let healthy = stats.isRunning;

    // Check if we missed too many executions
    if (stats.expectedExecutions > 0) {
      const missedExecutions = stats.expectedExecutions - stats.actualExecutions;
      healthy = healthy && (missedExecutions <= 2); // Allow up to 2 missed executions
    }

    // Check if last execution was too long ago
    if (stats.lastExecutionTime) {
      const timeSinceLastExecution = now - stats.lastExecutionTime;
      healthy = healthy && (timeSinceLastExecution < interval * 2); // Max 2x interval
    }

    return {
      ...stats,
      healthy,
      timeSinceLastExecution: stats.lastExecutionTime ? now - stats.lastExecutionTime : null
    };
  }

  // Force immediate message send (for testing)
  async sendNow() {
    this.log('info', 'Forcing immediate message send...');

    try {
      const result = await this.messenger.sendMessageWithRetry();
      this.log('info', 'Immediate message sent successfully');
      return result;
    } catch (error) {
      this.log('error', `Immediate message send failed: ${error.message}`);
      throw error;
    }
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const configLogLevel = config.get('logLevel');

    // Simple log level filtering
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    if (levels[level] <= levels[configLogLevel]) {
      console.log(`${timestamp} [${level.toUpperCase()}] [Scheduler] ${message}`);
    }
  }
}

module.exports = MessageScheduler;