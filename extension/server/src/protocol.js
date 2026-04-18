const fs = require('fs');

const read = (stream, cb) => {
  let buf = Buffer.alloc(0), want = 4;
  stream.on('data', d => {
    const chunk = Buffer.isBuffer(d) ? d : Buffer.from(d);
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= want) {
      if (want === 4) { want = buf.readUInt32LE(0) + 4; if (want === 4) continue; }
      if (buf.length >= want) { cb(JSON.parse(buf.slice(4, want).toString())); buf = buf.slice(want); want = 4; }
      else break;
    }
  });
};

const write = (stream, msg) => {
  const b = Buffer.from(JSON.stringify(msg));
  const h = Buffer.allocUnsafe(4); h.writeUInt32LE(b.length, 0);
  const buf = Buffer.concat([h, b]);
  if (stream.fd != null) {
    fs.writeSync(stream.fd, buf);
  } else {
    stream.write(buf);
  }
};

module.exports = { read, write };
