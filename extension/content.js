function getRequiredWindowMethod(win, name) {
  const fn = win[name];

  if (typeof fn !== 'function') {
    throw new Error(`${name} is not available in this tab`);
  }

  return fn.bind(win);
}

function createActions(win = window) {
  return {
    axtree: payload => getRequiredWindowMethod(win, 'getAXTree')(payload),
    click: ({ ref }) => {
      getRequiredWindowMethod(win, 'getByRef')(ref)?.click();
      return true;
    },
    scroll: ({ x = 0, y = 0 }) => {
      win.scrollBy({ left: x, top: y, behavior: 'smooth' });
      return true;
    },
    scrollIntoView: ({ ref }) => {
      getRequiredWindowMethod(win, 'getByRef')(ref)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    },
  };
}

function createRuntimeMessageListener(actions) {
  return (msg, _, send) => {
    const fn = actions[msg.action];

    if (!fn) {
      send({ ok: false, error: 'unknown: ' + msg.action });
      return true;
    }

    Promise.resolve()
      .then(() => fn(msg.payload || {}))
      .then(result => send({ ok: true, result }))
      .catch(error => send({ ok: false, error: error.message }));

    return true;
  };
}

const runtime =
  typeof browser !== 'undefined' ? browser.runtime :
  typeof chrome !== 'undefined' ? chrome.runtime :
  null;

if (runtime?.onMessage?.addListener) {
  runtime.onMessage.addListener(createRuntimeMessageListener(createActions()));
}

if (typeof module !== 'undefined') {
  module.exports = {
    createActions,
    createRuntimeMessageListener,
    getRequiredWindowMethod,
  };
}
