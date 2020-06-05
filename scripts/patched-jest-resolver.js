'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const path_1 = require('path');
const ts = require('typescript');
const defaultResolver_1 = require('jest-resolve/build/defaultResolver');
function getCompilerSetup(rootDir) {
  const tsConfigPath =
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.spec.json') ||
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.test.json') ||
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.jest.json');
  if (!tsConfigPath) {
    console.error(
      `Cannot locate a tsconfig.spec.json. Please create one at ${rootDir}/tsconfig.spec.json`
    );
  }
  const readResult = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    path_1.dirname(tsConfigPath)
  );
  const compilerOptions = config.options;
  const host = ts.createCompilerHost(compilerOptions, true);
  return { compilerOptions, host };
}
let compilerSetup;
module.exports = function (path, options) {
  const ext = path_1.extname(path);
  if (
    ext === '.css' ||
    ext === '.scss' ||
    ext === '.sass' ||
    ext === '.less' ||
    ext === '.styl'
  ) {
    return require.resolve('identity-obj-proxy');
  }
  // Try to use the defaultResolver
  try {
    if (path.indexOf('@nrwl/workspace') > -1) {
      throw 'Reference to local Nx package found. Use local version instead.';
    }
    return defaultResolver_1.default(path, options);
  } catch (e) {
    // Fallback to using typescript
    compilerSetup = compilerSetup || getCompilerSetup(options.rootDir);
    const { compilerOptions, host } = compilerSetup;
    return ts.resolveModuleName(path, options.basedir, compilerOptions, host)
      .resolvedModule.resolvedFileName;
  }
};
