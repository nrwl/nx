'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const path_1 = require('path');
const resolve_exports_1 = require('resolve.exports');
const jest_1 = require('jest');
const semver_1 = require('semver');
let compilerSetup;
let ts;
const jestMajorVersion = (0, semver_1.major)((0, jest_1.getVersion)());
function getCompilerSetup(rootDir) {
  const tsConfigPath =
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.spec.json') ||
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.test.json') ||
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.jest.json') ||
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.json');
  if (!tsConfigPath) {
    console.error(
      `Cannot locate a tsconfig.spec.json. Please create one at ${rootDir}/tsconfig.spec.json`
    );
  }
  const readResult = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    (0, path_1.dirname)(tsConfigPath)
  );
  const compilerOptions = config.options;
  const host = ts.createCompilerHost(compilerOptions, true);
  return { compilerOptions, host };
}
module.exports = function (path, options) {
  const ext = (0, path_1.extname)(path);
  if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less') {
    return require.resolve('identity-obj-proxy');
  }
  try {
    try {
      // Try to use the defaultResolver with default options
      return options.defaultResolver(path, options);
    } catch (e) {
      if (jestMajorVersion >= 30) {
        // The default resolver already handles what we had a workaround for in
        // previous versions. Let the error bubble up.
        throw e;
      }
      // Try to use the defaultResolver with a packageFilter
      return options.defaultResolver(path, {
        ...options,
        // @ts-expect-error packageFilter and pathFilter where available in Jest 29
        packageFilter: (pkg) => ({
          ...pkg,
          main: pkg.main || pkg.es2015 || pkg.module,
        }),
        pathFilter: (pkg) => {
          if (!pkg.exports) {
            return path;
          }
          return (0, resolve_exports_1.resolve)(pkg, path)?.[0] || path;
        },
      });
    }
  } catch (e) {
    if (
      path === 'jest-sequencer-@jest/test-sequencer' ||
      path === '@jest/test-sequencer' ||
      path.startsWith('jest-sequencer-')
    ) {
      return;
    }
    // Fallback to using typescript
    ts = ts || require('typescript');
    compilerSetup = compilerSetup || getCompilerSetup(options.rootDir);
    const { compilerOptions, host } = compilerSetup;
    const resolvedFileName = ts.resolveModuleName(
      path,
      (0, path_1.join)(options.basedir, 'fake-placeholder.ts'),
      compilerOptions,
      host
    ).resolvedModule?.resolvedFileName;
    if (!resolvedFileName) {
      throw new Error(`Could not resolve ${path}`);
    }
    return (0, path_1.resolve)(options.rootDir, resolvedFileName);
  }
};
