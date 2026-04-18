let PORT = null;
let ONBOARDING_OPENED = false;
let CONNECT_ATTEMPTS = 0;
let STOP_NATIVE_KEEPALIVE = null;
const CONTENT_SCRIPT_FILES = ['axtree.js', 'content.js'];
const RECEIVING_END_MISSING = 'Could not establish connection. Receiving end does not exist.';
const NATIVE_KEEPALIVE_INTERVAL_MS = 5_000;

function normalizeTabMessageError(error) {
  const message = error?.message || String(error);

  if (message.includes(RECEIVING_END_MISSING)) {
    return 'This tab does not allow Zen Bridge page scripts. Try a normal http(s) page instead of browser-internal pages like about:addons or about:debugging.';
  }

  return message;
}

function toErrorResponse(error) {
  return { ok: false, error: normalizeTabMessageError(error) };
}

function createKeepAliveMessage(now = Date.now) {
  return {
    id: `keepalive:${now()}`,
    action: 'ping',
  };
}

function isKeepAliveResponse(message) {
  return typeof message?.id === 'string'
    && message.id.startsWith('keepalive:')
    && message.ok === true
    && message.result === 'pong';
}

function startNativeKeepAlive(port, timerApi = globalThis) {
  const sendKeepAlive = () => {
    const message = createKeepAliveMessage();

    try {
      port.postMessage(message);
      console.log('[zen-bridge] keepalive ping sent');
    } catch (error) {
      console.error('[zen-bridge] keepalive ping failed:', error.message);
    }
  };

  sendKeepAlive();
  const timer = timerApi.setInterval(sendKeepAlive, NATIVE_KEEPALIVE_INTERVAL_MS);

  return () => {
    timerApi.clearInterval(timer);
  };
}

function shouldOpenOnboardingForDisconnect(message) {
  return message.includes('not found')
    || message.includes('No such')
    || message.includes('does not exist')
    || message.includes('could not start');
}

function injectContentScripts(tabsApi, tabId) {
  return CONTENT_SCRIPT_FILES.reduce(
    (promise, file) => promise.then(() => tabsApi.executeScript(tabId, { file })),
    Promise.resolve(),
  );
}

function injectAXTreeScript(tabsApi, tabId) {
  return tabsApi.executeScript(tabId, { file: 'axtree.js' });
}

function ensureTabReadyForScript(tabsApi, tabId) {
  if (typeof tabsApi.get !== 'function') {
    return Promise.resolve(null);
  }

  return tabsApi.get(tabId).then(tab => {
    console.log('[zen-bridge] target tab state:', JSON.stringify({
      id: tab.id,
      active: tab.active,
      status: tab.status,
      discarded: tab.discarded,
      hidden: tab.hidden,
      url: tab.url,
    }));

    if (tab.active || typeof tabsApi.update !== 'function') {
      return tab;
    }

    console.log('[zen-bridge] activating tab for script execution:', tabId);
    return tabsApi.update(tabId, { active: true });
  });
}

function buildAXTreeCode(payload = {}) {
  const encodedPayload = JSON.stringify(payload);
  return `(() => {
    const logs = [];
    const result = window.getAXTree(document.body, {
      ...${encodedPayload},
      logger: entry => logs.push(entry),
    });
    return { result, logs };
  })();`;
}

function executeAXTree(tabsApi, msg, reply) {
  return ensureTabReadyForScript(tabsApi, msg.tabId).then(
    () => injectAXTreeScript(tabsApi, msg.tabId).then(
      () => tabsApi.executeScript(msg.tabId, { code: buildAXTreeCode(msg.payload) }).then(
        result => {
          const payload = result[0] || { result: [], logs: [] };
          for (const entry of payload.logs || []) {
            console.log('[zen-bridge] axtree log:', JSON.stringify(entry));
          }

          const response = { ok: true, result: payload.result };
          reply(response);
          return response;
        },
        error => {
          const response = toErrorResponse(error);
          reply(response);
          return response;
        },
      ),
    ),
    error => {
      const response = toErrorResponse(error);
      reply(response);
      return response;
    },
  );
}

function relayTabMessage(tabsApi, msg, reply) {
  return tabsApi.sendMessage(msg.tabId, msg).then(
    result => {
      reply(result);
      return result;
    },
    () => injectContentScripts(tabsApi, msg.tabId).then(
      () => tabsApi.sendMessage(msg.tabId, msg).then(
        result => {
          reply(result);
          return result;
        },
        error => {
          const response = toErrorResponse(error);
          reply(response);
          return response;
        },
      ),
      error => {
        const response = toErrorResponse(error);
        reply(response);
        return response;
      },
    ),
  );
}

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

    if (isKeepAliveResponse(msg)) {
      console.log('[zen-bridge] keepalive pong received');
      return;
    }

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
    if (msg.action === 'axtree') {
      console.log('[zen-bridge] running axtree directly in tab', msg.tabId);
      executeAXTree(browser.tabs, msg, reply);
      return;
    }
    relayTabMessage(browser.tabs, msg, reply);
  });

  PORT.onDisconnect.addListener(() => {
    const err = browser.runtime.lastError;
    const msg = err?.message || '';
    console.error('[zen-bridge] disconnected. lastError:', JSON.stringify(err), 'message:', msg);
    console.error('[zen-bridge] disconnect stack:', new Error().stack);
    PORT = null;
    if (STOP_NATIVE_KEEPALIVE) {
      STOP_NATIVE_KEEPALIVE();
      STOP_NATIVE_KEEPALIVE = null;
    }

    if (shouldOpenOnboardingForDisconnect(msg)) {
      console.log('[zen-bridge] host not installed, opening onboarding');
      maybeOpenOnboarding();
      return;
    }

    console.log('[zen-bridge] retrying in 2s');
    setTimeout(connect, 2000);
  });

  console.log('[zen-bridge] listeners attached');
  STOP_NATIVE_KEEPALIVE = startNativeKeepAlive(PORT);
}

function maybeOpenOnboarding() {
  if (ONBOARDING_OPENED) return;
  ONBOARDING_OPENED = true;
  console.log('[zen-bridge] opening onboarding tab');
  browser.tabs.create({ url: browser.runtime.getURL('onboarding.html') });
}

if (typeof browser !== 'undefined') {
  browser.runtime.onMessage.addListener((msg, sender) => {
    console.log('[zen-bridge] runtime.onMessage:', msg);
    if (msg.action === 'status') {
      return Promise.resolve({ connected: !!PORT });
    }
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    buildAXTreeCode,
    CONTENT_SCRIPT_FILES,
    ensureTabReadyForScript,
    executeAXTree,
    injectAXTreeScript,
    injectContentScripts,
    isKeepAliveResponse,
    normalizeTabMessageError,
    relayTabMessage,
    startNativeKeepAlive,
    shouldOpenOnboardingForDisconnect,
    toErrorResponse,
  };
} else {
  console.log('[zen-bridge] background.js loading');
  browser.runtime.onInstalled.addListener(() => { console.log('[zen-bridge] onInstalled'); connect(); });
  browser.runtime.onStartup.addListener(() => { console.log('[zen-bridge] onStartup'); connect(); });
  connect();
  console.log('[zen-bridge] background.js loaded');
}
