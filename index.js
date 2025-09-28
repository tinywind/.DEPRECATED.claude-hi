/**
 * Claude Hi Service - Main entry point
 * Sends "hi" to Claude Code every 10 minutes
 */

const config = require('./src/config');
const ClaudeMessenger = require('./src/messenger');
const MessageScheduler = require('./src/scheduler');

class ClaudeHiService {
  constructor() {
    this.messenger = null;
    this.scheduler = null;
    this.isShuttingDown = false;
  }

  async initialize() {
    try {
      this.log('info', '===========================================');
      this.log('info', 'Claude Hi Service v1.0.0');
      this.log('info', `Environment: ${process.env.NODE_ENV || 'production'}`);
      this.log('info', `Interval: ${config.getFormattedInterval()}`);
      this.log('info', `Output: ${config.get('outputMode')}`);
      this.log('info', '===========================================');

      // Initialize messenger based on output mode
      const outputMode = config.get('outputMode');
      this.log('info', `Initializing messenger (mode: ${outputMode})...`);

      if (outputMode === 'claude') {
        const ClaudeCodeMessenger = require('./src/claude-messenger');
        this.messenger = new ClaudeCodeMessenger();
      } else {
        const ClaudeMessenger = require('./src/messenger');
        this.messenger = new ClaudeMessenger();
      }

      // Try to connect to Claude Code
      await this.messenger.connect();

      // Initialize scheduler
      this.log('info', 'Initializing message scheduler...');
      this.scheduler = new MessageScheduler(this.messenger);

      // Setup graceful shutdown
      this.setupShutdownHandlers();

      // Setup health check endpoint if in development
      if (config.isDev()) {
        this.setupHealthEndpoint();
      }

      this.log('info', 'Service initialized successfully');

    } catch (error) {
      this.log('error', `Failed to initialize service: ${error.message}`);
      throw error;
    }
  }

  async start() {
    try {
      this.log('info', 'Starting Claude Hi Service...');

      await this.scheduler.start();

      this.log('info', '✅ Service started successfully');
      this.log('info', `Sending "${config.get('message')}" every ${config.getFormattedInterval()}`);

      // Keep process alive
      if (!config.isTest()) {
        setInterval(() => {
          // Health check interval
          const health = this.getHealth();
          if (!health.healthy) {
            this.log('warn', 'Service health check failed', health);
          }
        }, 60000); // Check health every minute
      }

    } catch (error) {
      this.log('error', `Failed to start service: ${error.message}`);
      await this.shutdown(1);
    }
  }

  setupShutdownHandlers() {
    const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'];

    shutdownSignals.forEach(signal => {
      process.on(signal, async () => {
        this.log('info', `Received ${signal} signal`);
        await this.shutdown(0);
      });
    });

    process.on('uncaughtException', async (error) => {
      this.log('error', `Uncaught exception: ${error.message}`, error.stack);
      await this.shutdown(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      this.log('error', `Unhandled rejection at ${promise}:`, reason);
      await this.shutdown(1);
    });
  }

  setupHealthEndpoint() {
    const http = require('http');
    const port = process.env.HEALTH_PORT || 3001;

    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        const health = this.getHealth();
        res.writeHead(health.healthy ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health, null, 2));
      } else if (req.url === '/stats') {
        const stats = this.getStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats, null, 2));
      } else if (req.url === '/send' && req.method === 'POST') {
        // Force send a message immediately (for testing)
        this.scheduler.sendNow()
          .then(result => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result, null, 2));
          })
          .catch(error => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }, null, 2));
          });
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(port, () => {
      this.log('info', `Health check endpoint available at http://localhost:${port}/health`);
      this.log('info', `Stats endpoint available at http://localhost:${port}/stats`);
      this.log('info', `Force send endpoint available at POST http://localhost:${port}/send`);
    });

    this.healthServer = server;
  }

  getHealth() {
    const messengerHealth = this.messenger?.getHealthCheck() || { healthy: false };
    const schedulerHealth = this.scheduler?.getHealthCheck() || { healthy: false };

    return {
      healthy: messengerHealth.healthy && schedulerHealth.healthy,
      service: 'claude-hi',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      messenger: messengerHealth,
      scheduler: schedulerHealth
    };
  }

  getStats() {
    return {
      service: 'claude-hi',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      config: {
        interval: config.getFormattedInterval(),
        endpoint: config.get('claudeEndpoint'),
        environment: process.env.NODE_ENV || 'production'
      },
      messenger: this.messenger?.getStatus() || {},
      scheduler: this.scheduler?.getStats() || {}
    };
  }

  async shutdown(exitCode = 0) {
    if (this.isShuttingDown) {
      this.log('warn', 'Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.log('info', 'Shutting down Claude Hi Service...');

    try {
      // Stop scheduler
      if (this.scheduler) {
        this.scheduler.stop();
      }

      // Close messenger connection
      if (this.messenger) {
        await this.messenger.close();
      }

      // Close health server
      if (this.healthServer) {
        this.healthServer.close();
      }

      this.log('info', 'Service shutdown complete');

    } catch (error) {
      this.log('error', `Error during shutdown: ${error.message}`);
    }

    process.exit(exitCode);
  }

  log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const configLogLevel = config.get('logLevel');

    // Simple log level filtering
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    if (levels[level] <= levels[configLogLevel]) {
      console.log(`${timestamp} [${level.toUpperCase()}] [Main] ${message}`, ...args);
    }
  }
}

// Main execution
async function main() {
  const service = new ClaudeHiService();

  try {
    await service.initialize();
    await service.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Export for testing
if (require.main === module) {
  main();
}

module.exports = { ClaudeHiService, main };