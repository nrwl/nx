const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

console.log('Updating @nrwl/workspace package group');
const file = join(__dirname, '../build/packages/workspace/package.json');
const originalContents = readFileSync(file).toString();

const { version } = require(file);

writeFileSync(file, originalContents.replace(/\*/g, version));
