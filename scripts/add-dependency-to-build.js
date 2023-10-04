const { readJsonSync, writeJsonSync } = require('fs-extra');
const { join } = require('path');

const [package, dependency] = process.argv.slice(2);

const pkgPath = join(__dirname, '../build/packages', package, 'package.json');
const packageJson = readJsonSync(pkgPath);
const version = packageJson.version;
packageJson.dependencies[dependency] = version;

writeJsonSync(pkgPath, packageJson, { spaces: 2 });
