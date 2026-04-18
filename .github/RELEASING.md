# Releasing

## Automated via GitHub Actions

Tag a release and push:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The [Release workflow](workflows/release.yml) will:
1. Build and sign the extension via AMO
2. Attach the signed `.xpi` to a GitHub Release

## Secrets

Add these in your repo's Settings → Secrets and variables → Actions:

| Secret | Description |
|--------|-------------|
| `WEB_EXT_API_KEY` | JWT issuer from AMO developer profile |
| `WEB_EXT_API_SECRET` | JWT secret from AMO developer profile |

Get them at [addons.mozilla.org/developers](https://addons.mozilla.org/developers/).

## Manual fallback

If you need to sign locally:

```bash
cd extension
npm install
export WEB_EXT_API_KEY="your-jwt-issuer"
export WEB_EXT_API_SECRET="your-jwt-secret"
npx web-ext sign
```

## Review notes

Native Messaging extensions get extra scrutiny. Be ready to explain:

- What `server/` does: a local WebSocket bridge forwarding messages between the extension and CLI tools
- Data flow: Extension ↔ stdin/stdout ↔ Node server ↔ localhost WebSocket ↔ CLI client
- Security: WebSocket only binds to localhost; no remote connections accepted
- Permissions: `tabs`, `activeTab`, `\u003call_urls\u003e`, `nativeMessaging` are needed to query tabs and inject content scripts on demand
