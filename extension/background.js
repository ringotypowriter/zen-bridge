let PORT = null;
let ONBOARDING_OPENED = false;
let CONNECT_ATTEMPTS = 0;

function connect() {
  if (PORT) return;
  try {
    PORT = browser.runtime.connectNative('zen_bridge');
    CONNECT_ATTEMPTS++;
  } catch (e) {
    console.error('[zen-bridge] connectNative threw:', e.message);
    maybeOpenOnboarding();
    return;
  }

  console.log('[zen-bridge] connected');

  PORT.onMessage.addListener(msg => {
    const reply = o => { try { PORT.postMessage({ id: msg.id, ...o }); } catch(e) {} };

    if (msg.action === 'tabs') {
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
    console.error('[zen-bridge] disconnected:', msg);
    PORT = null;

    // Host not installed → open onboarding
    if (msg.includes('not found') || msg.includes('No such') || msg.includes('does not exist') || msg.includes('could not start') || CONNECT_ATTEMPTS === 1) {
      maybeOpenOnboarding();
      return;
    }

    // Otherwise retry
    setTimeout(connect, 2000);
  });
}

function maybeOpenOnboarding() {
  if (ONBOARDING_OPENED) return;
  ONBOARDING_OPENED = true;
  browser.tabs.create({ url: browser.runtime.getURL('onboarding.html') });
}

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === 'status') {
    return Promise.resolve({ connected: !!PORT });
  }
});

browser.runtime.onInstalled.addListener(connect);
browser.runtime.onStartup.addListener(connect);
connect();
