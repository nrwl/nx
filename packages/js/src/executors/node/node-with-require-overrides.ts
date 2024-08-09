const Module = require('module');
const url = require('node:url');
const originalLoader = Module._load;
const { logger } = require('@nx/devkit');
const readline = require('readline');

// To overrides the `process.on` method to prepend the app listener to the event listeners list.
process.on = (eventName, listener) => {
  process.prependListener(eventName, listener);
  return process;
};

// To overrides the `process.emit` method to execute the listeners in asynchronously.
// @ts-expect-error To ensure process.emit function is running in asynchronously
process.emit = async (eventName, ...args) => {
  const listeners = process.listeners(eventName);

  for (const listener of listeners) {
    // @ts-expect-error Making async listener to execute sequentially
    await listener(...args);
  }

  return true;
};

readline.emitKeypressEvents(process.stdin);

if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on('keypress', async (chunk, key) => {
  if (key && key.ctrl && key.name === 'c') {
    process.stdin.setRawMode(false); // To ensure nx terminal is not stuck in raw mode
    process.emit('SIGINT', 'SIGINT');
  }
});

logger.info('To exit the process with SIGINT, press Ctrl+C');

const dynamicImport = new Function('specifier', 'return import(specifier)');

const mappings = JSON.parse(process.env.NX_MAPPINGS);
const keys = Object.keys(mappings);
const fileToRun = url.pathToFileURL(process.env.NX_FILE_TO_RUN);

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

dynamicImport(fileToRun);
