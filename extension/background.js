let PORT = null;

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
    setTimeout(connect, 1000);
  });
}

connect();
