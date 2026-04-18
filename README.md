# Zen Bridge

Control Zen Browser (and other Firefox-based browsers) from the command line or any WebSocket client.

## Quick Start

### 1. Install the browser extension

Download the latest signed `.xpi` from [GitHub Releases](https://github.com/ringotypowriter/zen-bridge/releases) and drag it into Zen. Or install from [AMO](https://addons.mozilla.org/) once listed.

### 2. Install the Native Messaging host

The extension will automatically open a setup page if the host is missing. Run one command:

```bash
curl -fsSL https://github.com/ringotypowriter/zen-bridge/releases/latest/download/install.sh | bash
```

Or download the platform-specific **Bun-compiled** binary from the release page and run `install.sh` locally.

### Building the host binary from source

Requires [Bun](https://bun.sh):

```bash
cd extension/server
bun build --compile src/host.js --outfile zen-bridge-server
```

Then restart Zen or reload the extension.

### 3. Install the CLI

```bash
npm install -g zen-bridge-connector
# or clone and npm link
```

### 4. Use it

```bash
zen-bridge tabs
zen-bridge axtree --tab 42
zen-bridge screenshot --tab 42 --output ./shot.png
zen-bridge click --tab 42 --ref r7
zen-bridge runjs --tab 42 --code "document.title"
```

## Architecture

Zen Bridge is a three-piece system:

1. **Extension** (`extension/`) — Firefox WebExtension that exposes tabs, DOM, screenshots, and interactions.
2. **Server** (`extension/server/`) — Native host launched by the extension. Bridges the browser's internal protocol to a local WebSocket. Compiled with **Bun** (`bun build --compile`) into a single self-contained binary.
3. **Connector** (`connector/`) — CLI tool and reusable WebSocket client.

```
┌─────────────┐     Native Messaging      ┌──────────────┐     WebSocket      ┌─────────────┐
│   Browser   │ ←───────────────────────→ │  Server      │ ←───────────────→ │  Connector  │
│ Extension   │   (stdio, length-prefixed)│  (binary)    │                  │  (CLI)      │
└─────────────┘                           └──────────────┘                  └─────────────┘
```

## Project Layout

```
zen-bridge/
├── extension/          # Firefox WebExtension
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── axtree.js
│   ├── onboarding.html
│   ├── onboarding.js
│   └── server/         # Native Messaging host source
│       ├── package.json
│       ├── install.js
│       └── src/
│           ├── host.js
│           ├── server.js
│           └── protocol.js
├── connector/          # CLI / WebSocket client
│   ├── package.json
│   └── bin/zen-bridge
├── install.sh          # One-line host installer
└── skills/
    └── zen-browser/
        └── SKILL.md
```

## Protocol

All messages are JSON over WebSocket.

**Request:** `{ id, action, tabId?, payload? }`

**Response:** `{ id, ok, result?, error? }`

| Action | Description |
|--------|-------------|
| `tabs` | List all tabs |
| `screenshot` | Capture visible viewport as PNG file |
| `axtree` | Get simplified accessible DOM tree |
| `click` | Click element by `ref` |
| `scroll` | Scroll by `(x, y)` pixels |
| `scrollIntoView` | Scroll element by `ref` into center |
| `runjs` | Evaluate JS in the content-script context |

## License

MIT
