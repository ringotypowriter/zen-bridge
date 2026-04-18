let PORT = null;
let ONBOARDING_OPENED = false;

function connect() {
  if (PORT) return;
  PORT = browser.runtime.connectNative('zen_bridge');
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
      browser.tabs.captureVisibleTab(msg.windowId || browser.windows.WINDOW_ID_CURRENT, { format: 'png' }).then(dataUrl =>
        reply({ ok: true, result: dataUrl }),
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
    console.error('[zen-bridge] disconnected:', browser.runtime.lastError?.message);
    PORT = null;
    setTimeout(connect, 2000);
  });
}

function openOnboarding() {
  if (ONBOARDING_OPENED) return;
  ONBOARDING_OPENED = true;
  browser.tabs.create({ url: browser.runtime.getURL('onboarding.html') });
}

function probe() {
  try {
    const p = browser.runtime.connectNative('zen_bridge');
    let alive = true;
    p.onDisconnect.addListener(() => {
      alive = false;
      openOnboarding();
    });
    setTimeout(() => {
      if (alive) {
        p.disconnect();
        connect();
      }
    }, 500);
  } catch (e) {
    openOnboarding();
  }
}

browser.runtime.onInstalled.addListener(probe);
browser.runtime.onStartup.addListener(probe);
probe();
