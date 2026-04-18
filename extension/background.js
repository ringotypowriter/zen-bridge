let PORT = null;
let ONBOARDING_OPENED = false;

function connect() {
  PORT = chrome.runtime.connectNative('zen_bridge');
  console.log('[zen-bridge] connected');

  PORT.onMessage.addListener(msg => {
    const reply = o => { try { PORT.postMessage({ id: msg.id, ...o }); } catch(e) {} };

    if (msg.action === 'tabs') {
      chrome.tabs.query({}, tabs => reply({
        ok: true,
        result: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, active: t.active, windowId: t.windowId }))
      }));
      return;
    }
    if (msg.action === 'screenshot') {
      chrome.tabs.captureVisibleTab(msg.windowId || chrome.windows.WINDOW_ID_CURRENT, { format: 'png' }, dataUrl =>
        reply(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : { ok: true, result: dataUrl })
      );
      return;
    }
    chrome.tabs.sendMessage(msg.tabId, msg, res => {
      if (!chrome.runtime.lastError) { reply(res); return; }
      chrome.tabs.executeScript(msg.tabId, { file: 'content.js' }, () => {
        chrome.tabs.sendMessage(msg.tabId, msg, res2 =>
          reply(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : res2)
        );
      });
    });
  });

  PORT.onDisconnect.addListener(() => {
    console.error('[zen-bridge] disconnected:', chrome.runtime.lastError?.message);
    PORT = null;
    setTimeout(connect, 2000);
  });
}

function openOnboarding() {
  if (ONBOARDING_OPENED) return;
  ONBOARDING_OPENED = true;
  chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
}

function probe() {
  try {
    const p = chrome.runtime.connectNative('zen_bridge');
    p.onDisconnect.addListener(() => {
      openOnboarding();
    });
    setTimeout(() => {
      if (p) { p.disconnect(); connect(); }
    }, 500);
  } catch (e) {
    openOnboarding();
  }
}

chrome.runtime.onInstalled.addListener(probe);
chrome.runtime.onStartup.addListener(probe);
probe();
