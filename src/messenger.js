/**
 * Claude Code messenger for sending periodic messages to console
 */

const config = require('./config');

class ClaudeMessenger {
  constructor() {
    this.isConnected = true; // Always connected to console
    this.lastMessageTime = null;
    this.messageCount = 0;
    this.failedAttempts = 0;
  }

  async connect() {
    try {
      this.log('info', 'Connecting to Claude Code console output...');

      // Console is always available
      this.isConnected = true;
      this.log('info', 'Successfully connected to Claude Code console');

      return true;
    } catch (error) {
      this.isConnected = false;
      this.log('error', `Failed to connect: ${error.message}`);
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  async sendMessage(message = null) {
    if (!this.isConnected) {
      throw new Error('Not connected. Call connect() first.');
    }

    const content = message || config.get('message');

    try {
      this.log('debug', `Preparing to send message: "${content}"`);

      // The actual message to Claude Code - just print to console
      console.log('\n' + '='.repeat(50));
      console.log(`🤖 CLAUDE HI MESSAGE #${this.messageCount + 1}`);
      console.log('='.repeat(50));
      console.log(`📨 ${content}`);
      console.log(`⏰ ${new Date().toISOString()}`);
      console.log('='.repeat(50) + '\n');

      // Update success metrics
      this.lastMessageTime = new Date();
      this.messageCount++;
      this.failedAttempts = 0;

      this.log('info', `Message sent successfully (#${this.messageCount})`);

      return {
        success: true,
        messageId: this.messageCount,
        timestamp: this.lastMessageTime,
        content: content
      };

    } catch (error) {
      this.failedAttempts++;
      this.log('error', `Failed to send message: ${error.message}`);
      throw new Error(`Message send failed: ${error.message}`);
    }
  }

  async sendMessageWithRetry(message = null) {
    const maxRetries = config.get('retryAttempts');
    const retryDelay = config.get('retryDelay');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Reconnect if needed (though console is always available)
        if (!this.isConnected) {
          await this.connect();
        }

        return await this.sendMessage(message);

      } catch (error) {
        this.log('warn', `Message send attempt ${attempt}/${maxRetries} failed: ${error.message}`);

        if (attempt === maxRetries) {
          this.log('error', `All ${maxRetries} attempts failed`);
          throw error;
        }

        // Wait before retry
        this.log('debug', `Waiting ${retryDelay}ms before retry...`);
        await this.sleep(retryDelay);
      }
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      messageCount: this.messageCount,
      lastMessageTime: this.lastMessageTime,
      failedAttempts: this.failedAttempts,
      output: 'console'
    };
  }

  getHealthCheck() {
    const status = this.getStatus();
    const now = new Date();
    const timeSinceLastMessage = status.lastMessageTime ?
      (now - status.lastMessageTime) / 1000 : null;

    return {
      ...status,
      timeSinceLastMessage,
      healthy: status.connected && status.failedAttempts < 3
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const configLogLevel = config.get('logLevel');

    // Simple log level filtering
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    if (levels[level] <= levels[configLogLevel]) {
      console.log(`${timestamp} [${level.toUpperCase()}] [Messenger] ${message}`);
    }
  }

  async close() {
    this.isConnected = false;
    this.log('info', 'Claude Code messenger closed');
  }
}

module.exports = ClaudeMessenger;