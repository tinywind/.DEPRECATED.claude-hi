// Demo script to show multiple messages quickly
process.env.HI_INTERVAL = '2000'; // 2 seconds
process.env.LOG_LEVEL = 'info';

const { ClaudeHiService } = require('./index');

async function demo() {
  console.log('\n🎯 DEMO: Starting Claude Hi Service with 2-second intervals\n');
  console.log('You will see 5 messages over 10 seconds...\n');
  console.log('─'.repeat(50));

  const service = new ClaudeHiService();

  try {
    await service.initialize();
    await service.start();

    // Run for 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n─'.repeat(50));
    console.log('🎯 DEMO: Shutting down service...\n');

    // Override process.exit to prevent actual exit
    const originalExit = process.exit;
    process.exit = () => {};

    await service.shutdown(0);

    // Restore process.exit
    process.exit = originalExit;

    const stats = service.getStats();
    console.log('\n📊 Final Statistics:');
    console.log(`   Messages sent: ${stats.scheduler.actualExecutions}`);
    console.log(`   Total runtime: ${Math.floor(stats.scheduler.runtime / 1000)} seconds`);
    console.log(`   Success rate: ${stats.scheduler.successRate.toFixed(1)}%`);
    console.log('\n✅ Demo completed successfully!\n');

  } catch (error) {
    console.error('❌ Demo error:', error.message);
  }
}

demo().catch(console.error);