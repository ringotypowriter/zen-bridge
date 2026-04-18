const fs = require('fs');

const STDIN_FD = 0;
const STDOUT_FD = 1;
const READ_BUFFER_SIZE = 64 * 1024;

function read(inputFd, onMessage, onClose) {
  let frameBuffer = Buffer.alloc(0);
  const readBuffer = Buffer.allocUnsafe(READ_BUFFER_SIZE);

  function drainFrames() {
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
  }

  function pump() {
    fs.read(inputFd, readBuffer, 0, readBuffer.length, null, (error, bytesRead) => {
      if (error) {
        if (error.code === 'EINTR') {
          setImmediate(pump);
          return;
        }
        throw error;
      }

      if (bytesRead === 0) {
        if (onClose) {
          onClose();
        }
        return;
      }

      frameBuffer = Buffer.concat([
        frameBuffer,
        Buffer.from(readBuffer.subarray(0, bytesRead)),
      ]);

      drainFrames();
      setImmediate(pump);
    });
  }

  pump();
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
