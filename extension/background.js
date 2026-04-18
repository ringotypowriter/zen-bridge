let PORT = null;
let ONBOARDING_OPENED = false;
let CONNECT_ATTEMPTS = 0;

function connect() {
  console.log('[zen-bridge] connect() called, PORT=', PORT);
  if (PORT) {
    console.log('[zen-bridge] already connected, skipping');
    return;
  }
  try {
    PORT = browser.runtime.connectNative('zen_bridge');
    CONNECT_ATTEMPTS++;
    console.log('[zen-bridge] connectNative returned, attempt', CONNECT_ATTEMPTS);
  } catch (e) {
    console.error('[zen-bridge] connectNative threw:', e.message);
    maybeOpenOnboarding();
    return;
  }

  console.log('[zen-bridge] connected, setting up listeners');

  PORT.onMessage.addListener(msg => {
    console.log('[zen-bridge] NM msg received:', JSON.stringify(msg));
    const reply = o => {
      try {
        PORT.postMessage({ id: msg.id, ...o });
        console.log('[zen-bridge] NM reply sent');
      } catch(e) {
        console.error('[zen-bridge] postMessage failed:', e.message);
      }
    };

    if (msg.action === 'tabs') {
      console.log('[zen-bridge] handling tabs');
      browser.tabs.query({}).then(tabs => reply({
        ok: true,
        result: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, active: t.active, windowId: t.windowId }))
      }));
      return;
    }
    if (msg.action === 'screenshot') {
      browser.tabs.captureVisibleTab(msg.windowId || browser.windows.WINDOW_ID_CURRENT, { format: 'png' }).then(
        dataUrl => reply({ ok: true, result: dataUrl }),
        err => reply({ ok: false, error: err.message })
      );
      return;
    }
    if (msg.action === 'runjs') {
      browser.tabs.executeScript(msg.tabId, { code: msg.payload?.code || '' }).then(
        results => reply({ ok: true, result: results[0] }),
        err => reply({ ok: false, error: err.message })
      );
      return;
    }
    browser.tabs.sendMessage(msg.tabId, msg).then(
      res => reply(res),
      err => {
        browser.tabs.executeScript(msg.tabId, { file: 'content.js' }).then(() =>
          browser.tabs.sendMessage(msg.tabId, msg).then(
            res2 => reply(res2),
            err2 => reply({ ok: false, error: err2.message })
          )
        );
      }
    );
  });

  PORT.onDisconnect.addListener(() => {
    const err = browser.runtime.lastError;
    const msg = err?.message || '';
    console.error('[zen-bridge] disconnected. lastError:', JSON.stringify(err), 'message:', msg);
    console.error('[zen-bridge] disconnect stack:', new Error().stack);
    PORT = null;

    if (msg.includes('not found') || msg.includes('No such') || msg.includes('does not exist') || msg.includes('could not start') || CONNECT_ATTEMPTS === 1) {
      console.log('[zen-bridge] host not installed, opening onboarding');
      maybeOpenOnboarding();
      return;
    }

    console.log('[zen-bridge] retrying in 2s');
    setTimeout(connect, 2000);
  });

  console.log('[zen-bridge] listeners attached');
}

function maybeOpenOnboarding() {
  if (ONBOARDING_OPENED) return;
  ONBOARDING_OPENED = true;
  console.log('[zen-bridge] opening onboarding tab');
  browser.tabs.create({ url: browser.runtime.getURL('onboarding.html') });
}

browser.runtime.onMessage.addListener((msg, sender) => {
  console.log('[zen-bridge] runtime.onMessage:', msg);
  if (msg.action === 'status') {
    return Promise.resolve({ connected: !!PORT });
  }
});

console.log('[zen-bridge] background.js loading');
browser.runtime.onInstalled.addListener(() => { console.log('[zen-bridge] onInstalled'); connect(); });
browser.runtime.onStartup.addListener(() => { console.log('[zen-bridge] onStartup'); connect(); });
connect();
console.log('[zen-bridge] background.js loaded');
