const url = require('node:url');
const { patchSigint } = require('./patch-sigint');
const { patchRequire } = require('./patch-require');

patchSigint();
patchRequire();

const dynamicImport = new Function('specifier', 'return import(specifier)');
dynamicImport(url.pathToFileURL(process.env.NX_FILE_TO_RUN));
