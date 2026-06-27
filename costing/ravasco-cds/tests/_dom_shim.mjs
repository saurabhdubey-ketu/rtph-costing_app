// Side-effect-only module that installs minimal DOM/localStorage shims so
// modules written for the browser can be imported in plain Node.
const _store = {};
globalThis.localStorage = {
  getItem:    k => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
  setItem:    (k, v) => { _store[k] = v; },
  removeItem: k => { delete _store[k]; },
  get length() { return Object.keys(_store).length; },
  key:        i => Object.keys(_store)[i] ?? null,
};
globalThis.window           = globalThis;
globalThis.document         = {
  createElement:    () => ({ style: {}, addEventListener: () => {}, appendChild: () => {} }),
  querySelector:    () => null,
  querySelectorAll: () => [],
  getElementById:   () => null,
};
globalThis.CustomEvent      = class CustomEvent  { constructor(){} };
globalThis.Event            = class Event        { constructor(){} };
globalThis.HTMLElement      = class HTMLElement  {};
globalThis.MutationObserver = class MutationObserver { observe(){} disconnect(){} };
