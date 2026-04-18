const test = require('node:test');
const assert = require('node:assert/strict');

global.Node = { TEXT_NODE: 3 };
global.getComputedStyle = element => element.style;
global.window = {};
global.document = { body: null, querySelectorAll() { return []; } };

const {
  CANDIDATE_SELECTOR,
  MAX_LABEL_LENGTH,
  getCandidateElements,
  getAXTree,
  getDepthFromRoot,
  getLabel,
} = require('../axtree.js');

function makeElement({
  tagName,
  attributes = {},
  style = { display: 'block', visibility: 'visible' },
  value = '',
  placeholder = '',
  title = '',
  onclick = null,
  childNodes = [],
  children = [],
  ownerDocument = { getElementById() { return null; } },
  hidden = false,
} = {}) {
  return {
    tagName,
    attributes,
    style,
    value,
    placeholder,
    title,
    onclick,
    childNodes,
    children,
    ownerDocument,
    hidden,
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name);
    },
    matches(selector) {
      const selectors = selector.split(',').map(part => part.trim());
      return selectors.includes(this.tagName.toLowerCase()) || (selectors.includes('[onclick]') && this.hasAttribute('onclick'));
    },
    querySelectorAll(selector) {
      const selectors = selector.split(',').map(part => part.trim());
      const matches = [];

      const visit = element => {
        for (const child of element.children || []) {
          if (selectors.includes(child.tagName.toLowerCase()) || (selectors.includes('[onclick]') && child.hasAttribute('onclick'))) {
            matches.push(child);
          }

          visit(child);
        }
      };

      visit(this);
      return matches;
    },
  };
}

function linkChildren(element) {
  for (const child of element.children || []) {
    child.parentElement = element;
    linkChildren(child);
  }

  return element;
}

test('getLabel avoids innerText and uses direct text content', () => {
  const element = makeElement({
    tagName: 'BUTTON',
    childNodes: [
      { nodeType: Node.TEXT_NODE, textContent: ' Save   changes ' },
      { nodeType: 1, textContent: 'ignored child element text' },
    ],
  });

  assert.equal(getLabel(element), 'Save changes');
});

test('getAXTree stops at the configured visit limit', () => {
  const leaf = makeElement({ tagName: 'BUTTON' });
  const middle = makeElement({ tagName: 'DIV', children: [leaf] });
  const root = linkChildren(makeElement({ tagName: 'MAIN', children: [middle] }));

  const result = getAXTree(root, { maxVisitedNodes: 1, maxResults: 10 });

  assert.deepEqual(result, [
    { type: 'main', label: '', ref: 'r1', tag: 'MAIN' },
  ]);
});

test('getLabel truncates long labels to the configured limit', () => {
  const text = 'x'.repeat(MAX_LABEL_LENGTH + 10);
  const element = makeElement({
    tagName: 'BUTTON',
    attributes: { 'aria-label': text },
  });

  assert.equal(getLabel(element).length, MAX_LABEL_LENGTH);
});

test('getAXTree respects the configured depth limit', () => {
  const deepButton = makeElement({ tagName: 'BUTTON' });
  const grandchild = makeElement({ tagName: 'DIV', children: [deepButton] });
  const child = makeElement({ tagName: 'SECTION', children: [grandchild] });
  const root = linkChildren(makeElement({ tagName: 'MAIN', children: [child] }));

  const result = getAXTree(root, { maxDepth: 1 });

  assert.deepEqual(result, [
    { type: 'main', label: '', ref: 'r2', tag: 'MAIN' },
    { type: 'region', label: '', ref: 'r3', tag: 'SECTION' },
  ]);
});

test('getAXTree emits progress logs through the provided logger', () => {
  const logs = [];
  const button = makeElement({ tagName: 'BUTTON' });
  const root = linkChildren(makeElement({ tagName: 'MAIN', children: [button] }));

  getAXTree(root, { logger: entry => logs.push(entry), logEvery: 1 });

  assert.deepEqual(logs.map(entry => entry.type), ['start', 'progress', 'progress', 'finish']);
  assert.deepEqual(logs.at(-1), {
    type: 'finish',
    visited: 2,
    results: 2,
    truncated: false,
    maxDepthReached: 1,
  });
});

test('candidate scan finds only eligible AX nodes', () => {
  const button = makeElement({ tagName: 'BUTTON' });
  const div = makeElement({ tagName: 'DIV', children: [button] });
  const root = linkChildren(makeElement({
    tagName: 'MAIN',
    matches(selector) {
      return selector === CANDIDATE_SELECTOR;
    },
    querySelectorAll(selector) {
      assert.equal(selector, CANDIDATE_SELECTOR);
      return [button];
    },
    children: [div],
  }));

  assert.deepEqual(getCandidateElements(root), [root, button]);
});

test('depth is computed relative to the requested root', () => {
  const leaf = makeElement({ tagName: 'BUTTON' });
  const child = makeElement({ tagName: 'SECTION', children: [leaf] });
  const root = linkChildren(makeElement({ tagName: 'MAIN', children: [child] }));

  assert.equal(getDepthFromRoot(root, root), 0);
  assert.equal(getDepthFromRoot(child, root), 1);
  assert.equal(getDepthFromRoot(leaf, root), 2);
});
