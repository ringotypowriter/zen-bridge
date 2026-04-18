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

module.exports = ({ inputFd = protocol.STDIN_FD, outputFd = protocol.STDOUT_FD } = {}) => {
  log('server started, pid', process.pid);

  const pending = new Map();
  const clients = new Set();
  const wss = new WebSocket.Server({ port: 0 });

  protocol.read(
    inputFd,
    msg => {
      log('NM IN:', JSON.stringify(msg));

      const ws = pending.get(msg.id);
      if (ws?.readyState === 1) {
        log('NM -> WS forwarding reply');
        ws.send(JSON.stringify(msg));
        pending.delete(msg.id);
        return;
      }

      if (msg.action === 'ping') {
        log('NM ping, replying pong');
        protocol.write(outputFd, { id: msg.id, ok: true, result: 'pong' });
        return;
      }

      log('NM broadcast to', clients.size, 'clients');
      clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify(msg));
        }
      });
    },
    () => {
      log('stdin eof');
      wss.close(() => process.exit(0));
    },
  );

  wss.on('connection', ws => {
    log('WS client connected');
    clients.add(ws);

    ws.on('message', data => {
      log('WS raw data received, type:', typeof data, 'len:', data.length);

      try {
        const msg = JSON.parse(data);
        log('WS IN:', JSON.stringify(msg));
        pending.set(msg.id, ws);
        log('WS -> NM: about to write');
        protocol.write(outputFd, msg);
        log('WS -> NM: write succeeded');
      } catch (e) {
        log('WS error:', e.stack || e.message);
      }
    });

    ws.on('close', () => {
      log('WS client disconnected');
      clients.delete(ws);
    });
  });

  return new Promise(resolve => {
    wss.once('listening', () => {
      const port = wss.address().port;

      try {
        fs.writeFileSync(PORTFILE, String(port));
        log('listening on port', port, 'wrote', PORTFILE);
      } catch (e) {
        log('write portfile error:', e.message);
      }

      resolve(port);
    });
  });
};
