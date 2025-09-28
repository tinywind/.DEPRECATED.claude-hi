/**
 * Demo script to test actual Claude Code CLI integration
 */

// Use shorter interval for demo
process.env.HI_INTERVAL = '5000'; // 5 seconds
process.env.LOG_LEVEL = 'info';
process.env.OUTPUT_MODE = 'claude'; // Use Claude Code CLI

// Clear module cache to reload config
delete require.cache[require.resolve('./src/config')];

const config = require('./src/config');
const ClaudeCodeMessenger = require('./src/claude-messenger');
const MessageScheduler = require('./src/scheduler');

async function demoClaudeCode() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 CLAUDE CODE CLI INTEGRATION DEMO');
  console.log('='.repeat(60));
  console.log('\n📋 This demo will:');
  console.log('   1. Check Claude Code CLI availability');
  console.log('   2. Send a test message to Claude Code');
  console.log('   3. Schedule periodic messages every 5 seconds');
  console.log('   4. Run for 20 seconds (4 messages total)');
  console.log('\n' + '='.repeat(60) + '\n');

  const messenger = new ClaudeCodeMessenger();
  let scheduler = null;

  try {
    // Step 1: Check Claude Code CLI
    console.log('📌 Step 1: Checking Claude Code CLI...');
    await messenger.connect();
    console.log('   ✅ Claude Code CLI is available!\n');

    // Step 2: Send test message
    console.log('📌 Step 2: Sending test message to Claude Code...');
    const testResult = await messenger.sendMessage('Hello Claude! This is a test message from Claude Hi Service.');
    console.log(`   ✅ Test message sent successfully!\n`);

    // Wait a bit for user to see the test
    await sleep(2000);

    // Step 3: Start scheduler
    console.log('📌 Step 3: Starting scheduled messages (every 5 seconds)...');
    scheduler = new MessageScheduler(messenger);
    await scheduler.start();
    console.log('   ✅ Scheduler started!\n');

    // Step 4: Run for 20 seconds
    console.log('📌 Step 4: Running for 20 seconds...');
    console.log('   (You should see messages in Claude Code)\n');

    // Show countdown
    for (let i = 20; i > 0; i--) {
      process.stdout.write(`\r   ⏱️  Time remaining: ${i} seconds... `);
      await sleep(1000);
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('📊 DEMO RESULTS');
    console.log('='.repeat(60));

    // Get final stats
    const stats = scheduler.getStats();
    const messengerStatus = messenger.getStatus();

    console.log(`\n📈 Statistics:`);
    console.log(`   • Messages sent to Claude Code: ${messengerStatus.messageCount}`);
    console.log(`   • Scheduled executions: ${stats.actualExecutions}`);
    console.log(`   • Total runtime: ${Math.floor(stats.runtime / 1000)} seconds`);
    console.log(`   • Success rate: ${stats.successRate.toFixed(1)}%`);

    // Stop scheduler
    scheduler.stop();
    await messenger.close();

    console.log('\n✅ Demo completed successfully!');
    console.log('   Check your Claude Code window for the messages.\n');

  } catch (error) {
    console.error('\n❌ Demo error:', error.message);
    console.error('\n💡 Troubleshooting tips:');
    console.error('   1. Make sure Claude Code CLI is installed: claude --version');
    console.error('   2. Make sure you are logged in: claude setup-token');
    console.error('   3. Try sending a manual message: echo "test" | claude -p\n');

    if (scheduler) {
      scheduler.stop();
    }
    if (messenger) {
      await messenger.close();
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the demo
demoClaudeCode().catch(console.error);