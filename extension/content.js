const A = {
  axtree:   () => window.getAXTree(),
  click:    ({ ref }) => { window.getByRef(ref)?.click(); return true; },
  scroll:   ({ x = 0, y = 0 }) => { window.scrollBy({ left: x, top: y, behavior: 'smooth' }); return true; },
  scrollIntoView: ({ ref }) => { window.getByRef(ref)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; },
  runjs:    ({ code }) => { const r = eval(code); return r; },
};

chrome.runtime.onMessage.addListener((msg, _, send) => {
  const fn = A[msg.action];
  if (!fn) { send({ ok: false, error: 'unknown: ' + msg.action }); return true; }
  Promise.resolve(fn(msg.payload || {}))
    .then(r => send({ ok: true, result: r }))
    .catch(e => send({ ok: false, error: e.message }));
  return true;
});
