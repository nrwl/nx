const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const contents = readFileSync(join(__dirname, 'tsc.impl.js'));

writeFileSync(
  join(__dirname, 'node_modules/@nx/js/src/executors/tsc/tsc.impl.js'),
  contents
);

console.log('PATCHED NX JS');
