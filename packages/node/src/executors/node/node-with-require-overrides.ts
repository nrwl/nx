const Module = require('module');
const originalLoader = Module._load;

const mappings = JSON.parse(process.env.NX_MAPPINGS);
const keys = Object.keys(mappings);
const fileToRun = process.env.NX_FILE_TO_RUN;

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

require(fileToRun);
