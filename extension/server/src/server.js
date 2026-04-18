const WebSocket = require('ws');
const fs = require('fs');
const os = require('os');
const path = require('path');
const protocol = require('./protocol');

const PORTFILE = path.join(os.homedir(), '.zen-bridge-port');
const LOGFILE = path.join(os.homedir(), '.zen-bridge.log');

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  try { fs.appendFileSync(LOGFILE, line); } catch {}
}

module.exports = (nativeIn, nativeOut) => {
  log('server started, pid', process.pid);

  const pending = new Map();
  const clients = new Set();

  nativeIn.on('end', () => log('stdin end'));
  nativeIn.on('close', () => log('stdin close'));

  protocol.read(nativeIn, msg => {
    log('NM IN:', JSON.stringify(msg));
    const ws = pending.get(msg.id);
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify(msg));
      pending.delete(msg.id);
    } else {
      clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify(msg)));
    }
  });

  const wss = new WebSocket.Server({ port: 0 });
  wss.on('connection', ws => {
    log('WS client connected');
    clients.add(ws);
    ws.on('message', data => {
      try {
        const m = JSON.parse(data);
        log('WS IN:', JSON.stringify(m));
        pending.set(m.id, ws);
        protocol.write(nativeOut, m);
      } catch (e) {
        log('WS parse error:', e.message);
      }
    });
    ws.on('close', () => {
      log('WS client disconnected');
      clients.delete(ws);
    });
  });

  return new Promise(r => wss.once('listening', () => {
    const port = wss.address().port;
    try {
      fs.writeFileSync(PORTFILE, String(port));
      log('listening on port', port, 'wrote', PORTFILE);
    } catch (e) {
      log('write portfile error:', e.message);
    }
    r(port);
  }));
};
