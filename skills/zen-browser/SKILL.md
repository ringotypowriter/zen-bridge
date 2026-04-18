# Zen Browser Bridge

Control Zen Browser (Firefox-based) via Native Messaging + WebSocket bridge.

## When to use

Use when you need to inspect or interact with a live Zen Browser instance — list tabs, read page structure, take screenshots, click elements, scroll, or run JavaScript. Not a replacement for headless automation; only works when Zen is already running.

## Setup

1. Install the Firefox extension: open `about:debugging` → *This Zen* → *Load Temporary Add-on* → select `extension/manifest.json` from this repo.
2. Register the Native Messaging host:
   ```bash
   cd extension/server
   npm install
   node install.js
   ```
3. The extension auto-launches the server when Zen starts. Server writes its WebSocket port to `~/.zen-bridge-port`.
4. Install the CLI:
   ```bash
   cd connector
   npm install
   npm link
   ```

## CLI Actions

```bash
zen-bridge tabs
zen-bridge axtree --tab <id>
zen-bridge screenshot --tab <id> --output <path>
zen-bridge click --tab <id> --ref <ref>
zen-bridge scroll --tab <id> --x <n> --y <n>
zen-bridge scroll-into-view --tab <id> --ref <ref>
zen-bridge runjs --tab <id> --code "<js>"
```

Add `--json` for raw JSON output.

## Protocol

Request: `{id, action, tabId?, payload?}`  
Response: `{id, ok, result?, error?}`

| Action | tabId | Payload | Returns |
|--------|-------|---------|---------|
| `tabs` | no | — | `[{id, title, url, active, windowId}]` |
| `screenshot` | yes | — | File path (CLI writes to disk) |
| `axtree` | yes | — | `[{type, label, ref, tag}]` |
| `click` | yes | `{ref}` | `true` |
| `scroll` | yes | `{x, y}` | `true` |
| `scrollIntoView` | yes | `{ref}` | `true` |
| `runjs` | yes | `{code}` | eval result |

## Notes

- `ref` values are page-session scoped; refresh invalidates them.
- `runjs` executes in the content-script context, not the page context.
- Screenshot captures the visible viewport only.
- The server is started automatically by the extension. If the port file is missing, Zen is not running or the extension is not loaded.
