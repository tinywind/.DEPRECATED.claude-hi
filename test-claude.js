/**
 * Simple test for Claude Code CLI integration
 */

process.env.OUTPUT_MODE = 'claude';
process.env.LOG_LEVEL = 'info';

// Clear module cache
delete require.cache[require.resolve('./src/config')];

const ClaudeCodeMessenger = require('./src/claude-messenger');

async function simpleTest() {
  console.log('\n🧪 SIMPLE CLAUDE CODE TEST\n');

  const messenger = new ClaudeCodeMessenger();

  try {
    console.log('1. Connecting to Claude Code CLI...');
    await messenger.connect();

    console.log('2. Sending test message...');
    const startTime = Date.now();
    await messenger.sendMessage('Hi Claude! This is a test from Claude Hi Service.');
    const elapsed = Date.now() - startTime;

    console.log(`\n✅ Test completed in ${elapsed}ms\n`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }

  await messenger.close();
}

simpleTest().catch(console.error);