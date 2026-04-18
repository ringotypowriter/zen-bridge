# Zen Bridge Server

Node process that bridges Firefox Native Messaging to WebSocket.

## Install

```bash
npm install
node install.js
```

`install.js` creates a platform-specific wrapper script and registers the Native Messaging host manifest with Firefox/Zen.

## How it works

1. The Firefox extension spawns this process via `chrome.runtime.connectNative('zen_bridge')`.
2. The server reads length-prefixed JSON messages from stdin and writes responses to stdout.
3. Simultaneously, it starts a WebSocket server on a random free port.
4. The port is written to `~/.zen-bridge-port` so clients know where to connect.
5. Messages are forwarded bidirectionally: WebSocket ↔ Native Messaging ↔ Browser Extension.

## Logs

Server logs to `~/.zen-bridge.log` for debugging.
