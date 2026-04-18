const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAXTreeCode,
  CONTENT_SCRIPT_FILES,
  ensureTabReadyForScript,
  executeAXTree,
  normalizeTabMessageError,
  relayTabMessage,
} = require('../background.js');

test('axtree fallback injects both content scripts before retrying', async () => {
  const injectedFiles = [];
  const replies = [];
  let sendAttempts = 0;

  const tabsApi = {
    sendMessage(tabId, msg) {
      sendAttempts += 1;

      assert.equal(tabId, 3);
      assert.equal(msg.action, 'axtree');

      if (sendAttempts === 1) {
        return Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
      }

      return Promise.resolve({ ok: true, result: [{ ref: 'r1' }] });
    },
    executeScript(tabId, details) {
      injectedFiles.push([tabId, details.file]);
      return Promise.resolve();
    },
  };

  const result = await relayTabMessage(tabsApi, { action: 'axtree', tabId: 3 }, response => {
    replies.push(response);
  });

  assert.deepEqual(injectedFiles, CONTENT_SCRIPT_FILES.map(file => [3, file]));
  assert.deepEqual(replies, [{ ok: true, result: [{ ref: 'r1' }] }]);
  assert.deepEqual(result, { ok: true, result: [{ ref: 'r1' }] });
});

test('axtree fallback replies with the injection error when the tab blocks scripts', async () => {
  const replies = [];

  const tabsApi = {
    sendMessage() {
      return Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
    },
    executeScript() {
      return Promise.reject(new Error('Missing host permission for the tab'));
    },
  };

  const result = await relayTabMessage(tabsApi, { action: 'axtree', tabId: 14 }, response => {
    replies.push(response);
  });

  assert.deepEqual(replies, [{ ok: false, error: 'Missing host permission for the tab' }]);
  assert.deepEqual(result, { ok: false, error: 'Missing host permission for the tab' });
});

test('receiving-end errors are rewritten into a restricted-tab message', () => {
  assert.equal(
    normalizeTabMessageError(new Error('Could not establish connection. Receiving end does not exist.')),
    'This tab does not allow Zen Bridge page scripts. Try a normal http(s) page instead of browser-internal pages like about:addons or about:debugging.',
  );
});

test('axtree executes directly in the tab instead of using sendMessage', async () => {
  const executed = [];
  const replies = [];

  const tabsApi = {
    executeScript(tabId, details) {
      executed.push([tabId, details]);

      if (details.file === 'axtree.js') {
        return Promise.resolve();
      }

      return Promise.resolve([{ result: [{ ref: 'r1' }], logs: [{ type: 'finish', visited: 1, results: 1 }] }]);
    },
  };

  const result = await executeAXTree(
    tabsApi,
    { action: 'axtree', tabId: 11, payload: { maxResults: 25, maxDepth: 3 } },
    response => {
      replies.push(response);
    },
  );

  assert.deepEqual(executed, [
    [11, { file: 'axtree.js' }],
    [11, { code: `(() => {
    const logs = [];
    const result = window.getAXTree(document.body, {
      ...{"maxResults":25,"maxDepth":3},
      logger: entry => logs.push(entry),
    });
    return { result, logs };
  })();` }],
  ]);
  assert.deepEqual(replies, [{ ok: true, result: [{ ref: 'r1' }] }]);
  assert.deepEqual(result, { ok: true, result: [{ ref: 'r1' }] });
});

test('buildAXTreeCode serializes the payload for executeScript', () => {
  assert.equal(
    buildAXTreeCode({ maxResults: 100, maxDepth: 4 }),
    `(() => {
    const logs = [];
    const result = window.getAXTree(document.body, {
      ...{"maxResults":100,"maxDepth":4},
      logger: entry => logs.push(entry),
    });
    return { result, logs };
  })();`,
  );
});

test('inactive tabs are activated before direct script execution', async () => {
  const calls = [];

  const tabsApi = {
    get(tabId) {
      calls.push(['get', tabId]);
      return Promise.resolve({
        id: tabId,
        active: false,
        status: 'complete',
        discarded: false,
        hidden: false,
        url: 'https://example.com/',
      });
    },
    update(tabId, patch) {
      calls.push(['update', tabId, patch]);
      return Promise.resolve({ id: tabId, active: true });
    },
  };

  await ensureTabReadyForScript(tabsApi, 11);

  assert.deepEqual(calls, [
    ['get', 11],
    ['update', 11, { active: true }],
  ]);
});
