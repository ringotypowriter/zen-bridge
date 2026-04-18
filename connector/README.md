# Zen Bridge Connector

CLI tool and reusable WebSocket client for Zen Bridge.

## Install

```bash
npm install
# optional: add to PATH
npm link
```

## Usage

```bash
zen-bridge tabs
zen-bridge axtree --tab 42
zen-bridge screenshot --tab 42 --output ./shot.png
zen-bridge click --tab 42 --ref r7
zen-bridge scroll --tab 42 --x 0 --y 500
zen-bridge scroll-into-view --tab 42 --ref r12
zen-bridge runjs --tab 42 --code "document.title"
```

Use `--json` for raw JSON output.

## As a library

```js
const WebSocket = require('ws');
const fs = require('fs');

const port = fs.readFileSync(require('os').homedir() + '/.zen-bridge-port', 'utf8').trim();
const ws = new WebSocket('ws://localhost:' + port);

ws.on('open', () => {
  ws.send(JSON.stringify({ id: '1', action: 'tabs' }));
});

ws.on('message', data => {
  console.log(JSON.parse(data));
});
```
