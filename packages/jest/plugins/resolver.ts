import { dirname, extname, join, resolve } from 'path';
import { resolve as resolveExports } from 'resolve.exports';
import type { ResolverOptions } from 'jest-resolve';
import { getVersion } from 'jest';
import { major } from 'semver';

let compilerSetup;
let ts;
const jestMajorVersion = major(getVersion());

function getCompilerSetup(rootDir: string) {
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
    dirname(tsConfigPath)
  );
  const compilerOptions = config.options;
  const host = ts.createCompilerHost(compilerOptions, true);
  return { compilerOptions, host };
}

module.exports = function (path: string, options: ResolverOptions) {
  const ext = extname(path);
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

          return resolveExports(pkg, path)?.[0] || path;
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
      join(options.basedir, 'fake-placeholder.ts'),
      compilerOptions,
      host
    ).resolvedModule?.resolvedFileName;
    if (!resolvedFileName) {
      throw new Error(`Could not resolve ${path}`);
    }
    return resolve(options.rootDir, resolvedFileName);
  }
};
