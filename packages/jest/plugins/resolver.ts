import { dirname, extname, join, resolve } from 'path';
import { resolve as resolveExports, type Package } from 'resolve.exports';
import type { ResolverOptions } from 'jest-resolve';
import { getVersion } from 'jest';
import { major } from 'semver';

let compilerSetup: ReturnType<typeof getCompilerSetup> | undefined;
let ts: typeof import('typescript') | undefined;
const jestMajorVersion = major(getVersion());

function getCompilerSetup(ts: typeof import('typescript'), rootDir: string) {
  const tsConfigPath =
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.spec.json') ||
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.test.json') ||
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.jest.json') ||
    ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.json');

  if (!tsConfigPath) {
    const message = `Cannot locate a tsconfig.spec.json. Please create one at ${rootDir}/tsconfig.spec.json`;
    console.error(message);
    throw new Error(message);
  }

  const readResult = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    dirname(tsConfigPath)
  );
  const compilerOptions = config.options;
  if (!compilerOptions.baseUrl) {
    const { resolvePathsBaseUrl } = require('@nx/js');
    compilerOptions.baseUrl = resolvePathsBaseUrl(tsConfigPath);
  }
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
        pathFilter: (pkg: Package) => {
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
    const typescript: typeof import('typescript') = ts || require('typescript');
    ts = typescript;
    const rootDir = options.rootDir;
    if (!rootDir) {
      throw new Error(`Could not resolve ${path}`);
    }
    compilerSetup = compilerSetup || getCompilerSetup(typescript, rootDir);
    const { compilerOptions, host } = compilerSetup;
    const resolvedFileName = typescript.resolveModuleName(
      path,
      join(options.basedir, 'fake-placeholder.ts'),
      compilerOptions,
      host
    ).resolvedModule?.resolvedFileName;
    if (!resolvedFileName) {
      throw new Error(`Could not resolve ${path}`);
    }
    return resolve(rootDir, resolvedFileName);
  }
};
