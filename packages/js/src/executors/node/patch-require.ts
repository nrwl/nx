const Module = require('node:module');
const originalLoader = Module._load;

/**
 * Overrides require calls to map buildable workspace libs to their output location.
 * This is useful for running programs compiled via TSC/SWC that aren't bundled.
 */
export function patchRequire() {
  const mappings = JSON.parse(process.env.NX_MAPPINGS);
  const keys = Object.keys(mappings);

  Module._load = function (request, parent) {
    if (!parent) return originalLoader.apply(this, arguments);
    const match = keys.find((k) => request === k);
    if (match) {
      const newArguments = [...arguments];
      newArguments[0] = mappings[match];
      return originalLoader.apply(this, newArguments);
    } else {
      return originalLoader.apply(this, arguments);
    }
  };
}
