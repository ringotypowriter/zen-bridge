const ROLE = {
  A:'link', BUTTON:'button', INPUT:'input', TEXTAREA:'textarea',
  SELECT:'select', NAV:'navigation', FORM:'form', MAIN:'main',
  ARTICLE:'article', SECTION:'region', H1:'heading', H2:'heading',
  H3:'heading', H4:'heading', H5:'heading', H6:'heading',
};

let _c = 0;
const _m = new WeakMap();

const ref = el => { if (!_m.has(el)) _m.set(el, 'r' + ++_c); return _m.get(el); };

const visible = el => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
};

const label = el =>
  el.getAttribute('aria-label')
  || el.innerText?.slice(0, 120)
  || el.placeholder
  || el.title
  || '';

window.getAXTree = (root = document.body) => {
  const out = [];
  const walk = el => {
    if (!visible(el)) return;
    const tag = el.tagName;
    const role = ROLE[tag] || (el.onclick || el.getAttribute('onclick') ? 'clickable' : null);
    if (role) out.push({ type: role, label: label(el), ref: ref(el), tag });
    for (const c of el.children) walk(c);
  };
  walk(root);
  return out;
};

window.getByRef = r => {
  for (const el of document.querySelectorAll('*'))
    if (_m.get(el) === r) return el;
  return null;
};
