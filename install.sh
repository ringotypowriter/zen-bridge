#!/bin/bash
set -e

REPO="ringotypowriter/zen-bridge"
INSTALL_DIR="${HOME}/.local/share/zen-bridge"

# Detect platform
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

case "$(uname -s)" in
  Darwin) PLATFORM="macos-${ARCH}" ;;
  Linux)  PLATFORM="linux-x64" ;;
  *) echo "Unsupported OS"; exit 1 ;;
esac

BINARY="zen-bridge-server-${PLATFORM}"
LATEST_URL="https://github.com/${REPO}/releases/latest/download/${BINARY}"

echo "→ Installing Zen Bridge host for ${PLATFORM}..."

mkdir -p "${INSTALL_DIR}"

# Download binary
curl -fsSL -o "${INSTALL_DIR}/zen-bridge-server" "${LATEST_URL}"
chmod +x "${INSTALL_DIR}/zen-bridge-server"

# Install host manifest
MANIFEST_NAME="zen_bridge.json"
MANIFEST_DIR_MACOS="${HOME}/Library/Application Support/Mozilla/NativeMessagingHosts"
MANIFEST_DIR_ZEN="${HOME}/Library/Application Support/Zen/NativeMessagingHosts"
MANIFEST_DIR_LINUX="${HOME}/.mozilla/native-messaging-hosts"

MANIFEST_JSON=$(cat <<EOF
{
  "name": "zen_bridge",
  "description": "Zen Bridge Native Messaging Host",
  "path": "${INSTALL_DIR}/zen-bridge-server",
  "type": "stdio",
  "allowed_extensions": ["zen-bridge@yachiyo.local"]
}
EOF
)

install_manifest() {
  local dir="$1"
  mkdir -p "$dir"
  echo "$MANIFEST_JSON" > "${dir}/${MANIFEST_NAME}"
  echo "  Installed manifest to ${dir}"
}

if [ "$(uname -s)" = "Darwin" ]; then
  install_manifest "$MANIFEST_DIR_MACOS"
  install_manifest "$MANIFEST_DIR_ZEN"
else
  install_manifest "$MANIFEST_DIR_LINUX"
fi

echo "→ Done. Restart Zen Browser or reload the extension."
