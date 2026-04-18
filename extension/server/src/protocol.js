const fs = require('fs');

const STDIN_FD = 0;
const STDOUT_FD = 1;
const KEEPALIVE_INTERVAL_MS = 1000;

function createFrameReader(onMessage) {
  let frameBuffer = Buffer.alloc(0);

  return chunk => {
    frameBuffer = Buffer.concat([frameBuffer, Buffer.from(chunk)]);

    while (frameBuffer.length >= 4) {
      const bodyLength = frameBuffer.readUInt32LE(0);
      const frameLength = bodyLength + 4;

      if (frameBuffer.length < frameLength) {
        return;
      }

      const json = frameBuffer.subarray(4, frameLength).toString('utf8');
      frameBuffer = frameBuffer.subarray(frameLength);
      onMessage(JSON.parse(json));
    }
  };
}

function readFromStream(stream, onChunk, onClose) {
  stream.on('data', chunk => {
    onChunk(chunk);
  });

  stream.once('end', () => {
    if (onClose) {
      onClose();
    }
  });

  stream.once('error', error => {
    throw error;
  });

  if (typeof stream.resume === 'function') {
    stream.resume();
  }
}

function readFromNodeStdin(onChunk, onClose) {
  readFromStream(process.stdin, onChunk, onClose);
}

function readFromBunStdin(onChunk, onClose) {
  const keepAlive = setInterval(() => {}, KEEPALIVE_INTERVAL_MS);
  const reader = Bun.stdin.stream().getReader();

  async function pump() {
    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          if (onClose) {
            onClose();
          }
          return;
        }

        if (value && value.length > 0) {
          onChunk(value);
        }
      }
    } finally {
      clearInterval(keepAlive);
      reader.releaseLock();
    }
  }

  pump().catch(error => {
    throw error;
  });
}

function read(inputFd, onMessage, onClose) {
  const onChunk = createFrameReader(onMessage);

  if (typeof Bun !== 'undefined' && inputFd === STDIN_FD && Bun.stdin?.stream) {
    readFromBunStdin(onChunk, onClose);
    return;
  }

  if (inputFd === STDIN_FD && process.stdin?.fd === STDIN_FD) {
    readFromNodeStdin(onChunk, onClose);
    return;
  }

  readFromStream(
    fs.createReadStream(null, {
      fd: inputFd,
      autoClose: false,
    }),
    onChunk,
    onClose,
  );
}

function write(outputFd, msg) {
  const body = Buffer.from(JSON.stringify(msg));
  const header = Buffer.allocUnsafe(4);

  header.writeUInt32LE(body.length, 0);
  fs.writeSync(outputFd, header);
  fs.writeSync(outputFd, body);
}

module.exports = {
  read,
  write,
  STDIN_FD,
  STDOUT_FD,
};
