const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const [file] = process.argv.slice(2);

const originalContents = readFileSync(file).toString();

const packageJson = require(join(__dirname, '../package.json'));

const typescriptVersion = packageJson.devDependencies.typescript;
const prettierVersion = packageJson.devDependencies.prettier;

writeFileSync(
  file,
  originalContents
    .replace(/TYPESCRIPT_VERSION/g, typescriptVersion)
    .replace(/PRETTIER_VERSION/g, prettierVersion)
  // .replace(/TYPESCRIPT_VERSION/g, typescriptVersion)
);
