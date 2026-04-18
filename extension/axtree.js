(() => {
  if (window.__zenBridgeAXTreeLoaded) {
    return;
  }

  window.__zenBridgeAXTreeLoaded = true;

  const ROLE = {
    A: 'link',
    BUTTON: 'button',
    INPUT: 'input',
    TEXTAREA: 'textarea',
    SELECT: 'select',
    NAV: 'navigation',
    FORM: 'form',
    MAIN: 'main',
    ARTICLE: 'article',
    SECTION: 'region',
    H1: 'heading',
    H2: 'heading',
    H3: 'heading',
    H4: 'heading',
    H5: 'heading',
    H6: 'heading',
  };

  const MAX_VISITED_NODES = 5_000;
  const MAX_RESULTS = 1_000;
  const MAX_LABEL_LENGTH = 120;
  const DEFAULT_LOG_EVERY = 250;
  const CANDIDATE_SELECTOR = [
    'a',
    'button',
    'input',
    'textarea',
    'select',
    'nav',
    'form',
    'main',
    'article',
    'section',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    '[onclick]',
  ].join(',');

  let counter = 0;
  const refs = new WeakMap();

  function getRef(element) {
    if (!refs.has(element)) {
      refs.set(element, `r${++counter}`);
    }

    return refs.get(element);
  }

  function normalizeWhitespace(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  function directText(element) {
    if (!element?.childNodes) {
      return '';
    }

    let text = '';

    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent) {
        continue;
      }

      text += ` ${node.textContent}`;

      if (text.length >= MAX_LABEL_LENGTH * 2) {
        break;
      }
    }

    return normalizeWhitespace(text).slice(0, MAX_LABEL_LENGTH);
  }

  function getLabel(element) {
    const ariaLabel = element.getAttribute('aria-label');

    if (ariaLabel) {
      return ariaLabel.slice(0, MAX_LABEL_LENGTH);
    }

    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy && element.ownerDocument?.getElementById) {
      const labelledElement = element.ownerDocument.getElementById(ariaLabelledBy.trim());
      const labelledText = labelledElement?.textContent ? normalizeWhitespace(labelledElement.textContent) : '';

      if (labelledText) {
        return labelledText.slice(0, MAX_LABEL_LENGTH);
      }
    }

    return (
      element.value ||
      element.placeholder ||
      element.title ||
      element.getAttribute('alt') ||
      directText(element) ||
      ''
    ).slice(0, MAX_LABEL_LENGTH);
  }

  function isHidden(element) {
    if (!element || element.hidden || element.getAttribute('aria-hidden') === 'true') {
      return true;
    }

    const style = getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden';
  }

  function getRole(element) {
    if (element.hasAttribute('onclick')) {
      return 'clickable';
    }

    if (typeof element.onclick === 'function') {
      return 'clickable';
    }

    return ROLE[element.tagName] || null;
  }

  function logEntry(logger, entry) {
    if (typeof logger === 'function') {
      logger(entry);
      return;
    }

    console.log('[zen-bridge][axtree]', JSON.stringify(entry));
  }

  function getCandidateElements(root) {
    const candidates = [];

    if (typeof root.matches === 'function' && root.matches(CANDIDATE_SELECTOR)) {
      candidates.push(root);
    }

    if (typeof root.querySelectorAll !== 'function') {
      return candidates;
    }

    for (const element of root.querySelectorAll(CANDIDATE_SELECTOR)) {
      candidates.push(element);
    }

    return candidates;
  }

  function getDepthFromRoot(element, root) {
    let depth = 0;
    let current = element;

    while (current && current !== root) {
      current = current.parentElement;
      depth += 1;
    }

    return current === root ? depth : Number.POSITIVE_INFINITY;
  }

  function getAXTree(root = document.body, options = {}) {
    if (!root) {
      return [];
    }

    const maxVisitedNodes = options.maxVisitedNodes || MAX_VISITED_NODES;
    const maxResults = options.maxResults || MAX_RESULTS;
    const maxDepth = options.maxDepth ?? Number.POSITIVE_INFINITY;
    const logEvery = options.logEvery || DEFAULT_LOG_EVERY;
    const logger = options.logger;
    const candidates = getCandidateElements(root);
    const out = [];
    let visited = 0;
    let maxDepthReached = 0;

    logEntry(logger, {
      type: 'start',
      maxVisitedNodes,
      maxResults,
      maxDepth: Number.isFinite(maxDepth) ? maxDepth : null,
      logEvery,
    });

    for (const element of candidates) {
      if (visited >= maxVisitedNodes || out.length >= maxResults) {
        break;
      }

      visited += 1;
      const depth = getDepthFromRoot(element, root);
      if (depth > maxDepthReached) {
        maxDepthReached = depth;
      }

      if (!element || depth > maxDepth || isHidden(element)) {
        continue;
      }

      const role = getRole(element);
      if (role) {
        out.push({
          type: role,
          label: getLabel(element),
          ref: getRef(element),
          tag: element.tagName,
        });
      }

      if (visited % logEvery === 0) {
        logEntry(logger, {
          type: 'progress',
          visited,
          results: out.length,
          depth,
        });
      }
    }

    logEntry(logger, {
      type: 'finish',
      visited,
      results: out.length,
      truncated: visited < candidates.length,
      maxDepthReached,
    });

    return out;
  }

  function getByRef(targetRef, root = document) {
    for (const element of root.querySelectorAll('*')) {
      if (refs.get(element) === targetRef) {
        return element;
      }
    }

    return null;
  }

  window.getAXTree = getAXTree;
  window.getByRef = targetRef => getByRef(targetRef);

  if (typeof module !== 'undefined') {
    module.exports = {
      CANDIDATE_SELECTOR,
      DEFAULT_LOG_EVERY,
      MAX_LABEL_LENGTH,
      MAX_RESULTS,
      MAX_VISITED_NODES,
      directText,
      getAXTree,
      getByRef,
      getCandidateElements,
      getDepthFromRoot,
      getLabel,
      getRole,
      isHidden,
      logEntry,
      normalizeWhitespace,
    };
  }
})();
