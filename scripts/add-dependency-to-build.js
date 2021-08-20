const { readJsonSync, writeJsonSync } = require('fs-extra');
const { join } = require('path');

const [package, dependency] = process.argv.slice(2);

const pkgPath = join(__dirname, '../build/packages', package, 'package.json');
const packageJson = readJsonSync(pkgPath);
const [dependencyPkg, dependencyVersion] = dependency.split('@');
packageJson.dependencies[dependencyPkg] = dependencyVersion;

writeJsonSync(pkgPath, packageJson, { spaces: 2 });
