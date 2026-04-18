const fs = require('fs');
const path = require('path');
const LOGFILE = path.join(require('os').homedir(), '.zen-bridge.log');

function log(...args) {
  try { fs.appendFileSync(LOGFILE, `[${new Date().toISOString()}] ${args.join(' ')}\n`); } catch {}
}

process.on('uncaughtException', e => { log('uncaught:', e.stack || e.message); process.exit(1); });
process.on('unhandledRejection', e => { log('unhandled:', e.stack || e.message); });
process.on('exit', c => log('exit code', c));

log('startup');

try {
  const server = require('./server');
  server(process.stdin, process.stdout).then(port => {
    log('ready on port', port);
    console.error('Zen Bridge ws://localhost:' + port);
  }).catch(e => {
    log('server error:', e.stack || e.message);
  });
} catch (e) {
  log('startup error:', e.stack || e.message);
  process.exit(1);
}
