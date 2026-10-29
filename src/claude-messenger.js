/**
 * Claude Code CLI messenger - sends messages to actual Claude Code
 */

const { execFile } = require('child_process');
const config = require('./config');

class ClaudeCodeMessenger {
  constructor() {
    this.isConnected = false;
    this.lastMessageTime = null;
    this.messageCount = 0;
    this.failedAttempts = 0;
  }

  async connect() {
    try {
      this.log('info', 'Checking Claude Code CLI availability...');

      // Check if Claude Code CLI is available
      const version = await this.executeCommand('claude', ['--version']);

      if (version) {
        this.isConnected = true;
        this.log('info', `Connected to Claude Code CLI (${version.trim()})`);
        return true;
      }
    } catch (error) {
      this.isConnected = false;
      this.log('error', `Failed to connect to Claude Code CLI: ${error.message}`);
      throw new Error(`Claude Code CLI not available: ${error.message}`);
    }
  }

  async sendMessage(message = null) {
    if (!this.isConnected) {
      throw new Error('Not connected to Claude Code CLI. Call connect() first.');
    }

    const content = message || config.get('message');

    try {
      this.log('debug', `Sending message to Claude Code: "${content}"`);

      // Format the message with context
      const formattedMessage = this.formatMessage(content);

      const result = await this.executeCommand('claude', ['-p', formattedMessage]);

      // Update success metrics
      this.lastMessageTime = new Date();
      this.messageCount++;
      this.failedAttempts = 0;

      this.log('info', `Message #${this.messageCount} sent to Claude Code`);

      // Also display in local console for visibility
      console.log('\n' + '='.repeat(50));
      console.log(`🤖 SENT TO CLAUDE CODE - MESSAGE #${this.messageCount}`);
      console.log('='.repeat(50));
      console.log(`📨 ${content}`);
      console.log(`⏰ ${this.lastMessageTime.toISOString()}`);
      console.log(`✅ Claude Code Response: ${result ? 'Received' : 'Sent'}`);
      console.log('='.repeat(50) + '\n');

      return {
        success: true,
        messageId: this.messageCount,
        timestamp: this.lastMessageTime,
        content: content,
        response: result
      };

    } catch (error) {
      this.failedAttempts++;
      this.log('error', `Failed to send message to Claude Code: ${error.message}`);
      throw new Error(`Message send failed: ${error.message}`);
    }
  }

  formatMessage(content) {
    // Format the message to be clear it's an automated message
    const timestamp = new Date().toISOString();
    return `[Automated Message from Claude Hi Service at ${timestamp}] ${content}`;
  }

  executeCommand(command, args) {
    return new Promise((resolve, reject) => {
      execFile(command, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          this.log('debug', `Command error: ${error.message}`);
          reject(error);
          return;
        }

        if (stderr) {
          this.log('debug', `Command stderr: ${stderr}`);
        }

        resolve(stdout);
      });
    });
  }

  async sendMessageWithRetry(message = null) {
    const maxRetries = config.get('retryAttempts');
    const retryDelay = config.get('retryDelay');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Reconnect if needed
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
      output: 'Claude Code CLI'
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
      console.log(`${timestamp} [${level.toUpperCase()}] [ClaudeCode] ${message}`);
    }
  }

  async close() {
    this.isConnected = false;
    this.log('info', 'Claude Code messenger closed');
  }
}

module.exports = ClaudeCodeMessenger;