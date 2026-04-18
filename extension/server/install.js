const fs = require('fs');
const path = require('path');

const name = 'zen_bridge';
const node = process.execPath;
const script = path.resolve(__dirname, 'src/host.js');

const wrapperPath = path.resolve(__dirname, 'bin/zen-bridge-host');
const wrapper = process.platform === 'win32'
  ? `@echo off\n"${node}" "${script}" %*\n`
  : `#!/bin/sh\nexec "${node}" "${script}" "$@"\n`;

fs.writeFileSync(wrapperPath, wrapper);
fs.chmodSync(wrapperPath, 0o755);

const manifest = {
  name,
  description: 'Zen Bridge Native Messaging Host',
  path: wrapperPath,
  type: 'stdio',
  allowed_extensions: ['zen-bridge@yachiyo.local']
};

const dirs = [
  path.join(process.env.HOME, 'Library/Application Support/Mozilla/NativeMessagingHosts'),
  path.join(process.env.HOME, 'Library/Application Support/Zen/NativeMessagingHosts'),
];

for (const dir of dirs) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(manifest, null, 2));
  console.log('Installed to', dir);
}
