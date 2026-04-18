const fs = require('fs');
const path = require('path');

const LOGFILE = path.join(require('os').homedir(), '.zen-bridge.log');

function log(...args) {
  try { fs.appendFileSync(LOGFILE, `[${new Date().toISOString()}] ${args.join(' ')}\n`); } catch {}
}

process.on('uncaughtException', e => {
  log('uncaught:', e.stack || e.message);
  process.exit(1);
});

process.on('unhandledRejection', e => {
  log('unhandled:', e.stack || e.message);
  process.exit(1);
});

process.on('exit', code => log('exit code', code));

log('startup');

try {
  const server = require('./server');
  process.on('exit', () => {
    server.removePortFile();
  });
  server({ inputFd: 0, outputFd: 1 }).then(port => {
    log('ready on port', port);
  }).catch(e => {
    log('server error:', e.stack || e.message);
    process.exit(1);
  });
} catch (e) {
  log('startup error:', e.stack || e.message);
  process.exit(1);
}
