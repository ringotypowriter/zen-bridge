const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createActions,
  createRuntimeMessageListener,
} = require('../content.js');

function flushMicrotasks() {
  return new Promise(resolve => setImmediate(resolve));
}

test('axtree replies with an error when the AX helper is missing', async () => {
  const listener = createRuntimeMessageListener(createActions({
    getByRef() {
      return null;
    },
    scrollBy() {},
  }));

  const replies = [];
  const keepChannelOpen = listener({ action: 'axtree' }, null, response => {
    replies.push(response);
  });

  assert.equal(keepChannelOpen, true);

  await flushMicrotasks();

  assert.deepEqual(replies, [
    { ok: false, error: 'getAXTree is not available in this tab' },
  ]);
});

test('axtree passes payload options through to the AX helper', async () => {
  const payloads = [];
  const listener = createRuntimeMessageListener(createActions({
    getAXTree(payload) {
      payloads.push(payload);
      return [{ ref: 'r1' }];
    },
    getByRef() {
      return null;
    },
    scrollBy() {},
  }));

  const replies = [];
  listener({ action: 'axtree', payload: { maxResults: 10, maxDepth: 2 } }, null, response => {
    replies.push(response);
  });

  await flushMicrotasks();

  assert.deepEqual(payloads, [{ maxResults: 10, maxDepth: 2 }]);
  assert.deepEqual(replies, [{ ok: true, result: [{ ref: 'r1' }] }]);
});
