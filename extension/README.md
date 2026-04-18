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

## Development

```bash
npm install
npm run run        # Launch Zen with the extension loaded
npm run build      # Package into dist/zen-bridge.zip
```

## Quick Test

For quick testing without any setup:

1. Open Zen → `about:debugging` → *This Zen*
2. *Load Temporary Add-on* → select `manifest.json`
3. Extension stays loaded until Zen restarts
