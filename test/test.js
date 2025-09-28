/**
 * Test suite for Claude Hi Service
 */

// Set test environment BEFORE requiring modules
process.env.NODE_ENV = 'test';
process.env.HI_INTERVAL = '5000'; // 5 seconds for testing
process.env.OUTPUT_MODE = 'console';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

const assert = require('assert');

// Clear module cache and reload config
delete require.cache[require.resolve('../src/config')];
const config = require('../src/config');
const ClaudeMessenger = require('../src/messenger');
const MessageScheduler = require('../src/scheduler');
const { ClaudeHiService } = require('../index');

// Mock console output capture
class ConsoleCapture {
  constructor() {
    this.messages = [];
    this.originalConsoleLog = null;
  }

  start() {
    this.messages = [];
    this.originalConsoleLog = console.log;

    // Intercept console.log
    console.log = (...args) => {
      const message = args.join(' ');
      this.messages.push(message);
      // Still output to real console for debugging if needed
      if (process.env.DEBUG_TESTS) {
        this.originalConsoleLog(...args);
      }
    };
  }

  stop() {
    if (this.originalConsoleLog) {
      console.log = this.originalConsoleLog;
    }
  }

  getMessages() {
    return this.messages;
  }

  getHiMessages() {
    return this.messages.filter(msg => msg.includes('CLAUDE HI MESSAGE'));
  }

  reset() {
    this.messages = [];
  }
}

// Test utilities
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForMessages(capture, count, timeout = 10000) {
  const start = Date.now();
  while (capture.getHiMessages().length < count) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout waiting for ${count} messages`);
    }
    await sleep(100);
  }
}

// Test suite
async function runTests() {
  console.log('\n=== Running Claude Hi Service Tests ===\n');

  const capture = new ConsoleCapture();

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Configuration loading
  console.log('Test 1: Configuration loading...');
  try {
    assert.strictEqual(config.get('message'), 'hi');
    assert.strictEqual(config.get('interval'), 5000); // Test interval
    assert.strictEqual(config.get('outputMode'), 'console');
    assert.strictEqual(config.isTest(), true);
    console.log('✅ Test 1 passed: Configuration loaded correctly');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
    testsFailed++;
  }

  // Test 2: Messenger connection (always succeeds for console)
  console.log('\nTest 2: Messenger connection...');
  try {
    const messenger = new ClaudeMessenger();
    await messenger.connect();
    assert.strictEqual(messenger.isConnected, true);
    console.log('✅ Test 2 passed: Messenger connected successfully');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
    testsFailed++;
  }

  // Test 3: Send single message to console
  console.log('\nTest 3: Send single message to console...');
  try {
    capture.start();
    capture.reset();

    const messenger = new ClaudeMessenger();
    await messenger.connect();
    const result = await messenger.sendMessage('test message');

    capture.stop();

    assert.strictEqual(result.success, true);
    assert.strictEqual(capture.getHiMessages().length, 1);
    assert(capture.messages.some(msg => msg.includes('test message')));
    console.log('✅ Test 3 passed: Single message sent to console successfully');
    testsPassed++;
  } catch (error) {
    capture.stop();
    console.error('❌ Test 3 failed:', error.message);
    testsFailed++;
  }

  // Test 4: Scheduler basic operation
  console.log('\nTest 4: Scheduler basic operation...');
  try {
    capture.start();
    capture.reset();

    const messenger = new ClaudeMessenger();
    await messenger.connect();
    const scheduler = new MessageScheduler(messenger);

    await scheduler.start();

    // Wait for first message (should be immediate)
    await waitForMessages(capture, 1, 2000);
    assert.strictEqual(capture.getHiMessages().length, 1);
    assert(capture.messages.some(msg => msg.includes('hi')));

    scheduler.stop();
    capture.stop();
    console.log('✅ Test 4 passed: Scheduler sends messages to console correctly');
    testsPassed++;
  } catch (error) {
    capture.stop();
    console.error('❌ Test 4 failed:', error.message);
    testsFailed++;
  }

  // Test 5: Scheduler interval timing
  console.log('\nTest 5: Scheduler interval timing (waiting 5 seconds)...');
  try {
    capture.start();
    capture.reset();

    const messenger = new ClaudeMessenger();
    await messenger.connect();
    const scheduler = new MessageScheduler(messenger);

    const startTime = Date.now();
    await scheduler.start();

    // Wait for 2 messages (immediate + one after 5 seconds)
    await waitForMessages(capture, 2, 7000);

    const elapsed = Date.now() - startTime;
    const messages = capture.getHiMessages();
    assert.strictEqual(messages.length, 2);

    // Check timing between messages (should be ~5 seconds)
    // Allow 500ms tolerance
    assert(elapsed >= 4500 && elapsed <= 5500, `Interval was ${elapsed}ms, expected ~5000ms`);

    scheduler.stop();
    capture.stop();
    console.log('✅ Test 5 passed: Scheduler maintains correct interval');
    testsPassed++;
  } catch (error) {
    capture.stop();
    console.error('❌ Test 5 failed:', error.message);
    testsFailed++;
  }

  // Test 6: Message format verification
  console.log('\nTest 6: Message format verification...');
  try {
    capture.start();
    capture.reset();

    const messenger = new ClaudeMessenger();
    await messenger.connect();
    await messenger.sendMessage('hi');

    capture.stop();

    const messages = capture.messages;
    assert(messages.some(msg => msg.includes('CLAUDE HI MESSAGE')));
    assert(messages.some(msg => msg.includes('📨 hi')));
    assert(messages.some(msg => msg.includes('⏰')));

    console.log('✅ Test 6 passed: Message format is correct');
    testsPassed++;
  } catch (error) {
    capture.stop();
    console.error('❌ Test 6 failed:', error.message);
    testsFailed++;
  }

  // Test 7: Service integration test
  console.log('\nTest 7: Service integration test...');
  try {
    // Suppress output for this test
    process.env.LOG_LEVEL = 'error';

    capture.start();
    capture.reset();

    // Create and initialize service
    const service = new ClaudeHiService();
    await service.initialize();

    // Start service (but don't wait forever)
    const startPromise = service.start();

    // Wait for a couple of messages
    await waitForMessages(capture, 2, 8000);

    const messages = capture.getHiMessages();
    assert(messages.length >= 2, 'Should have received at least 2 messages');

    // Check service health
    const health = service.getHealth();
    assert.strictEqual(health.healthy, true);

    // Get stats
    const stats = service.getStats();
    assert(stats.scheduler.actualExecutions >= 2);

    // Shutdown service
    process.exit = (code) => { /* prevent exit during test */ };
    await service.shutdown(0);

    capture.stop();

    console.log('✅ Test 7 passed: Service integration works correctly');
    testsPassed++;
  } catch (error) {
    capture.stop();
    console.error('❌ Test 7 failed:', error.message);
    testsFailed++;
  }

  // Test 8: Force send functionality
  console.log('\nTest 8: Force send functionality...');
  try {
    capture.start();
    capture.reset();

    const messenger = new ClaudeMessenger();
    await messenger.connect();
    const scheduler = new MessageScheduler(messenger);

    // Force send immediately
    const result = await scheduler.sendNow();
    assert.strictEqual(result.success, true);
    assert.strictEqual(capture.getHiMessages().length, 1);

    capture.stop();
    console.log('✅ Test 8 passed: Force send works correctly');
    testsPassed++;
  } catch (error) {
    capture.stop();
    console.error('❌ Test 8 failed:', error.message);
    testsFailed++;
  }

  // Print summary
  console.log('\n=== Test Summary ===');
  console.log(`Total tests: ${testsPassed + testsFailed}`);
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);

  if (testsFailed > 0) {
    process.exit(1);
  }

  console.log('\n✅ All tests passed!');
  process.exit(0);
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});