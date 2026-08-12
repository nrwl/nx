// Mock for @clack/prompts - it is ESM-only and breaks Jest in CommonJS mode.
// Specs drive the prompts by overriding these, e.g.
//   const clack = require('@clack/prompts');
//   clack.autocomplete.mockResolvedValueOnce('eslint');
const cancelSymbol = Symbol.for('clack:cancel');

const noop = () => Promise.resolve(undefined);

module.exports = {
  autocomplete: noop,
  autocompleteMultiselect: noop,
  multiselect: noop,
  select: noop,
  text: noop,
  confirm: noop,
  password: noop,
  note: () => {},
  intro: () => {},
  outro: () => {},
  cancel: () => {},
  log: { info: () => {}, warn: () => {}, error: () => {}, success: () => {} },
  isCancel: (value) => value === cancelSymbol,
  // Exposed so specs can assert cancellation handling without importing clack.
  __cancelSymbol: cancelSymbol,
};
