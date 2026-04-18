const PLATFORM_MAP = {
  'MacIntel': 'macos-x64',
  'MacPPC': 'macos-x64',
};

const REPO = 'ringotypowriter/zen-bridge';
const arch = navigator.userAgent.includes('arm64') || navigator.platform === 'MacAppleSilicon' ? 'arm64' : 'x64';
const platform = navigator.platform.startsWith('Mac') ? `macos-${arch}` : 'linux-x64';
const binary = `zen-bridge-server-${platform}`;

function setStatus(id, text, cls) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'status ' + (cls || '');
}

function check() {
  browser.runtime.sendNativeMessage('zen_bridge', { id: 'ping', action: 'ping' })
    .then(() => setStatus('conn', 'Connected! You can close this tab.', 'ok'))
    .catch(() => setStatus('conn', 'Not connected yet. Run the installer and refresh.', 'err'));
}

document.getElementById('platform').textContent = platform;

document.getElementById('dl').addEventListener('click', () => {
  const url = `https://github.com/${REPO}/releases/latest/download/${binary}`;
  browser.downloads.download({ url, filename: binary, saveAs: false });
  setStatus('platform', `Downloading ${binary}...`, 'ok');
});

document.getElementById('cmd').textContent =
  `curl -fsSL https://github.com/${REPO}/releases/latest/download/install.sh | bash`;

check();
setInterval(check, 3000);
