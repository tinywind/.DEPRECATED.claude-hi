/**
 * Simple Claude Code CLI test with timing measurement
 */

process.env.OUTPUT_MODE = 'claude';
process.env.LOG_LEVEL = 'info';

// Clear cache
Object.keys(require.cache).forEach(key => {
  if (key.includes('claude-hi')) delete require.cache[key];
});

const ClaudeCodeMessenger = require('./src/claude-messenger');

async function testClaude() {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 CLAUDE CODE CLI INTEGRATION TEST');
  console.log('='.repeat(60) + '\n');

  const messenger = new ClaudeCodeMessenger();

  try {
    // Step 1: Check CLI availability
    console.log('📌 Step 1: Checking Claude Code CLI...');
    const connectStart = Date.now();
    await messenger.connect();
    const connectTime = Date.now() - connectStart;
    console.log(`   ✅ Connected in ${connectTime}ms\n`);

    // Step 2: Send a simple message
    console.log('📌 Step 2: Sending message to Claude...');
    console.log('   (This may take 10-30 seconds as Claude processes the message)\n');

    const sendStart = Date.now();
    const result = await messenger.sendMessage('Hi Claude! Please just respond with "Message received" to confirm you got this.');
    const sendTime = Date.now() - sendStart;

    console.log(`\n   ✅ Message sent and processed in ${(sendTime / 1000).toFixed(1)} seconds`);

    // Step 3: Show results
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60));

    console.log('\n✅ Success Metrics:');
    console.log(`   • Claude CLI Version: Available`);
    console.log(`   • Connection Time: ${connectTime}ms`);
    console.log(`   • Message Processing: ${(sendTime / 1000).toFixed(1)}s`);
    console.log(`   • Total Messages: ${messenger.messageCount}`);
    console.log(`   • Status: ${messenger.isConnected ? 'Connected' : 'Disconnected'}`);

    console.log('\n💡 Notes:');
    console.log('   • Claude processes messages thoughtfully, hence the delay');
    console.log('   • Each message creates a new conversation');
    console.log('   • Responses appear in your Claude Code window');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check Claude Code is installed: claude --version');
    console.error('   2. Check you are logged in: claude setup-token');
    console.error('   3. Try manually: claude -p "test"');
  }

  await messenger.close();
  console.log('\n✅ Test completed!\n');
}

testClaude().catch(console.error);