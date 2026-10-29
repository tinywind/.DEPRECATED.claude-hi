const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.LOG_LEVEL = 'error';
const ClaudeCodeMessenger = require('../src/claude-messenger');

async function run() {
  const temporary = path.resolve(__dirname, '..', '.tmp');
  fs.mkdirSync(temporary, {recursive: true});
  const root = fs.mkdtempSync(path.join(temporary, 'claude-command-'));
  const originalPath = process.env.PATH;
  const originalLog = console.log;
  const capture = path.join(root, 'argv.json');
  const marker = path.join(root, 'shell-ran');
  const executable = path.join(root, 'claude');
  fs.writeFileSync(executable, `#!${process.execPath}
const fs = require('fs');
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(capture)}, JSON.stringify(args));
if (args[0] === '--version') process.stdout.write('fixture-cli 1.0.0');
else if (args[1].includes('fixture-failure')) {process.stderr.write('fixture failure'); process.exitCode = 7;}
else process.stdout.write('fixture response');
`, {mode: 0o700});
  process.env.PATH = root + path.delimiter + originalPath;
  console.log = () => {};
  try {
    const messenger = new ClaudeCodeMessenger();
    await assert.rejects(messenger.sendMessage('before connect'), /Not connected/);
    assert.equal(await messenger.connect(), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(capture)), ['--version']);
    const payload = `Quotes " and ' \\ newline\n$(printf ran > ${marker}) backtick \`printf marker\` ; & | > <`;
    const result = await messenger.sendMessage(payload);
    assert.equal(fs.existsSync(marker), false, 'message content must never run as a shell command');
    const args = JSON.parse(fs.readFileSync(capture));
    assert.equal(args.length, 2);
    assert.equal(args[0], '-p');
    assert.match(args[1], /^\[Automated Message from Claude Hi Service at [^\]]+\] /);
    assert.equal(args[1].slice(args[1].indexOf('] ') + 2), payload);
    assert.equal(result.content, payload);
    assert.equal(result.response, 'fixture response');
    assert.equal(messenger.getStatus().messageCount, 1);
    assert.equal(messenger.getHealthCheck().healthy, true);
    await assert.rejects(messenger.sendMessage('fixture-failure'), /Message send failed/);
    assert.equal(messenger.getStatus().failedAttempts, 1);
    assert.equal(messenger.getStatus().messageCount, 1);
    await messenger.close();
    assert.equal(messenger.getStatus().connected, false);
    fs.unlinkSync(executable);
    process.env.PATH = root;
    await assert.rejects(messenger.connect(), /not available/);
    assert.equal(messenger.getStatus().connected, false);
  } finally {
    console.log = originalLog;
    process.env.PATH = originalPath;
    fs.rmSync(root, {recursive: true, force: true});
  }
  console.log('Claude command security: literal argv, no shell execution, real child-process success/failure and health checks passed.');
}

run().catch(error => {console.error(error); process.exitCode = 1;});
