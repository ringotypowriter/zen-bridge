# Zen Bridge Extension

Firefox WebExtension that exposes browser internals to external tools via Native Messaging.

## Files

- `manifest.json` — Extension manifest (v2, Firefox-compatible)
- `background.js` — Background script; connects to Native Messaging host and routes messages
- `content.js` — Injected into pages; dispatches DOM actions (click, scroll, eval)
- `axtree.js` — DOM walker that builds a simplified accessible tree with stable refs

## Server

The `server/` directory contains a Node process that the extension spawns via Native Messaging. It bridges the browser's internal protocol to a WebSocket so any tool can connect.

See `server/README.md` for setup.
