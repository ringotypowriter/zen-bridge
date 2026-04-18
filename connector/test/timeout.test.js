const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUEST_TIMEOUT_MS,
  buildRequest,
} = require('../bin/zen-bridge');

test('connector requests wait 30 seconds before timing out', () => {
  assert.equal(REQUEST_TIMEOUT_MS, 30_000);
});

test('axtree requests include result and depth limits', () => {
  assert.deepEqual(
    buildRequest('axtree', { tab: '11', limit: '25', depth: '3' }),
    {
      action: 'axtree',
      request: {
        tabId: 11,
        payload: {
          maxResults: 25,
          maxDepth: 3,
        },
      },
    },
  );
});
