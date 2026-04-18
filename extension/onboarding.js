function setStatus(text, cls) {
  const el = document.getElementById('conn');
  el.textContent = text;
  el.className = 'status ' + (cls || '');
}

function check() {
  browser.runtime.sendNativeMessage('zen_bridge', { id: 'ping', action: 'ping' })
    .then(() => setStatus('Connected! You can close this tab.', 'ok'))
    .catch(() => setStatus('Not connected yet. Run the command above and refresh this page.', 'err'));
}

document.getElementById('copy').addEventListener('click', () => {
  const cmd = document.getElementById('cmd').textContent;
  navigator.clipboard.writeText(cmd).then(() => {
    const btn = document.getElementById('copy');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
});

check();
setInterval(check, 3000);
