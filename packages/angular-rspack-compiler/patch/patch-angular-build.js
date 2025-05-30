const { readFileSync, writeFileSync } = require('fs');

function main() {
  const angularBuildPackageJson = require.resolve(
    '@angular/build/package.json'
  );
  const fileContentsJson = JSON.parse(
    readFileSync(angularBuildPackageJson, 'utf8')
  );
  fileContentsJson.exports['./src/tools/esbuild/javascript-transformer'] =
    './src/tools/esbuild/javascript-transformer.js';
  fileContentsJson.exports[
    './src/tools/angular/compilation/parallel-compilation'
  ] = './src/tools/angular/compilation/parallel-compilation.js';
  fileContentsJson.exports[
    './src/tools/angular/compilation/angular-compilation'
  ] = './src/tools/angular/compilation/angular-compilation.js';
  fileContentsJson.exports['./src/tools/angular/compilation/jit-compilation'] =
    './src/tools/angular/compilation/jit-compilation.js';
  fileContentsJson.exports['./src/tools/angular/compilation/aot-compilation'] =
    './src/tools/angular/compilation/aot-compilation.js';
  fileContentsJson.exports[
    './src/tools/esbuild/angular/component-stylesheets'
  ] = './src/tools/esbuild/angular/component-stylesheets.js';

  writeFileSync(
    angularBuildPackageJson,
    JSON.stringify(fileContentsJson, null, 2)
  );
}

main();
