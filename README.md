# Zen Bridge

Control Zen Browser (and other Firefox-based browsers) from the command line or any WebSocket client.

Zen Bridge is a three-piece system:

1. **Extension** (`extension/`) — a Firefox WebExtension that runs inside the browser, exposing tabs, DOM, screenshots, and interactions.
2. **Server** (`extension/server/`) — a Node process launched by the extension via Native Messaging; it bridges the browser's internal protocol to a local WebSocket.
3. **Connector** (`connector/`) — a CLI tool (and reusable WebSocket client) that talks to the server.

## Quick Start

### 1. Install the browser extension

Download the latest signed `.xpi` from [GitHub Releases](https://github.com/ringotypowriter/zen-bridge/releases) and drag it into Zen. Or install from [AMO](https://addons.mozilla.org/) once listed.

### 2. Register the Native Messaging host

```bash
git clone https://github.com/ringotypowriter/zen-bridge.git
cd zen-bridge/extension/server
npm install
node install.js
```

This creates a small shell wrapper and drops the Native Messaging host manifest into the browser's config directory so the extension can spawn the server.

### 3. Install the CLI

```bash
cd ../../connector
npm install
npm link   # or add ./bin to your PATH
```

The extension auto-launches the server when Zen starts. The server writes its WebSocket port to `~/.zen-bridge-port`.

### 4. Use it

```bash
zen-bridge tabs
zen-bridge axtree --tab 42
zen-bridge screenshot --tab 42 --output ./shot.png
zen-bridge click --tab 42 --ref r7
zen-bridge runjs --tab 42 --code "document.title"
```

## Architecture

```
┌─────────────┐     Native Messaging      ┌──────────────┐     WebSocket      ┌─────────────┐
│   Browser   │ ←───────────────────────→ │  Server      │ ←───────────────→ │  Connector  │
│ Extension   │   (stdio, length-prefixed)│  (Node)      │                  │  (CLI)      │
└─────────────┘                           └──────────────┘                  └─────────────┘
```

- The extension holds all browser state and permissions.
- The server is stateless; it only forwards messages between the extension and WebSocket clients.
- The connector is a pure WebSocket client; you can replace it with any language.

## Project Layout

```
zen-bridge/
├── extension/          # Firefox WebExtension
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── axtree.js
│   └── server/         # Native Messaging → WebSocket bridge
│       ├── install.js
│       ├── package.json
│       └── src/
│           ├── host.js
│           ├── server.js
│           └── protocol.js
├── connector/          # CLI / WebSocket client
│   ├── package.json
│   └── bin/zen-bridge
└── skills/
    └── zen-browser/
        └── SKILL.md    # Agent skill instructions
```

## Protocol

All messages are JSON over WebSocket.

**Request:** `{ id, action, tabId?, payload? }`

**Response:** `{ id, ok, result?, error? }`

| Action | Description |
|--------|-------------|
| `tabs` | List all tabs |
| `screenshot` | Capture visible viewport as base64 PNG |
| `axtree` | Get simplified accessible DOM tree |
| `click` | Click element by `ref` |
| `scroll` | Scroll by `(x, y)` pixels |
| `scrollIntoView` | Scroll element by `ref` into center |
| `runjs` | Evaluate JS in the content-script context |

## License

MIT
