const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

function encodeMessage(message) {
  const body = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);

  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Child did not exit within ${timeoutMs}ms`));
    }, timeoutMs);

    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });

    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function readFrame(stream, timeoutMs) {
  return new Promise((resolve, reject) => {
    let frameBuffer = Buffer.alloc(0);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for native message after ${timeoutMs}ms`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      stream.off('data', onData);
      stream.off('end', onEnd);
      stream.off('error', onError);
    }

    function onData(chunk) {
      frameBuffer = Buffer.concat([frameBuffer, chunk]);

      if (frameBuffer.length < 4) {
        return;
      }

      const bodyLength = frameBuffer.readUInt32LE(0);
      const frameLength = bodyLength + 4;

      if (frameBuffer.length < frameLength) {
        return;
      }

      cleanup();
      resolve(JSON.parse(frameBuffer.subarray(4, frameLength).toString('utf8')));
    }

    function onEnd() {
      cleanup();
      reject(new Error('stdout ended before a full native message was received'));
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    stream.on('data', onData);
    stream.once('end', onEnd);
    stream.once('error', onError);
  });
}

test('protocol reader stays alive until the first delayed native message arrives', async t => {
  const child = spawn(process.execPath, ['-e', `
    const protocol = require('./src/protocol');
    protocol.read(
      protocol.STDIN_FD,
      message => {
        protocol.write(protocol.STDOUT_FD, {
          id: message.id,
          ok: true,
          result: 'pong',
        });
      },
      () => process.exit(0),
    );
  `], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'ignore'],
  });

  t.after(() => {
    if (child.exitCode === null) {
      child.kill('SIGKILL');
    }
  });

  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(child.exitCode, null, 'host exited before stdin delivered a message');

  child.stdin.write(encodeMessage({ id: 'delayed', action: 'ping' }));

  const reply = await readFrame(child.stdout, 2000);
  assert.deepEqual(reply, { id: 'delayed', ok: true, result: 'pong' });

  child.stdin.end();

  const exit = await waitForExit(child, 2000);
  assert.equal(exit.signal, null);
  assert.equal(exit.code, 0);
});

test('compiled Bun protocol reader stays alive until the first delayed native message arrives', async t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zen-bridge-bun-'));
  const entrypointPath = path.join(tempDir, 'protocol-check.js');
  const binaryPath = path.join(tempDir, 'protocol-check');

  fs.writeFileSync(entrypointPath, `
    const protocol = require(${JSON.stringify(path.join(__dirname, 'src/protocol.js'))});
    protocol.read(
      protocol.STDIN_FD,
      message => {
        protocol.write(protocol.STDOUT_FD, {
          id: message.id,
          ok: true,
          result: 'pong',
        });
      },
      () => process.exit(0),
    );
  `);

  const build = spawnSync('bun', ['build', '--compile', entrypointPath, '--outfile', binaryPath], {
    cwd: __dirname,
    encoding: 'utf8',
  });

  assert.equal(
    build.status,
    0,
    [build.stdout, build.stderr].filter(Boolean).join('\n'),
  );

  const child = spawn(binaryPath, [], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'ignore'],
  });

  t.after(() => {
    if (child.exitCode === null) {
      child.kill('SIGKILL');
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(child.exitCode, null, 'compiled host exited before stdin delivered a message');

  child.stdin.write(encodeMessage({ id: 'compiled-delayed', action: 'ping' }));

  const reply = await readFrame(child.stdout, 2000);
  assert.deepEqual(reply, { id: 'compiled-delayed', ok: true, result: 'pong' });

  child.stdin.end();

  const exit = await waitForExit(child, 2000);
  assert.equal(exit.signal, null);
  assert.equal(exit.code, 0);
});
