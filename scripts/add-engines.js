const { readJsonSync, writeJsonSync } = require('fs-extra');
const { join } = require('path');

const package = process.argv[2];

const engines = readJsonSync(`package.json`).engines;

const path = join(__dirname, '../build/packages', package, 'package.json');
const packageJson = readJsonSync(path);
packageJson.engines = engines;
writeJsonSync(path, packageJson, { spaces: 2 });
