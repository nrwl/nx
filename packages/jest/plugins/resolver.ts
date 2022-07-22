import type defaultResolver from 'jest-resolve/build/defaultResolver';
import type { PkgJson } from 'jest-resolve/build/fileWalkers';
import { dirname, extname } from 'path';
import { resolve as resolveExports } from 'resolve.exports';

interface ResolveOptions {
  packageFilter?: (pkg: PkgJson) => PkgJson;
  rootDir: string;
  basedir: string;
  paths: string[];
  moduleDirectory: string[];
  browser: boolean;
  extensions: string[];
  defaultResolver: typeof defaultResolver;
}

let compilerSetup;
let ts;

function getCompilerSetup(rootDir: string) {
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
    dirname(tsConfigPath)
  );
  const compilerOptions = config.options;
  const host = ts.createCompilerHost(compilerOptions, true);
  return { compilerOptions, host };
}
// https://jestjs.io/docs/upgrading-to-jest28#packagejson-exports
const pkgNamesToTarget = new Set([
  'nanoid',
  'uuid',
  'rxjs',
  '@firebase/auth',
  '@firebase/storage',
  '@firebase/functions',
  '@firebase/database',
  '@firebase/auth-compat',
  '@firebase/database-compat',
  '@firebase/app-compat',
  '@firebase/firestore',
  '@firebase/firestore-compat',
  '@firebase/messaging',
  '@firebase/util',
  ...(process.env.NX_JEST_RESOLVER_PACKAGES
    ? process.env.NX_JEST_RESOLVER_PACKAGES.split(',')
    : []
  )
    .map((p) => p.trim())
    .filter((p) => p),
]);
module.exports = function (path: string, options: ResolveOptions) {
  const ext = extname(path);
  if (
    ext === '.css' ||
    ext === '.scss' ||
    ext === '.sass' ||
    ext === '.less' ||
    ext === '.styl'
  ) {
    return require.resolve('identity-obj-proxy');
  }
  try {
    try {
      // Try to use the defaultResolver with default options
      return options.defaultResolver(path, {
        ...options,
        packageFilter: (pkg) => {
          if (options?.packageFilter) {
            pkg = options.packageFilter(pkg);
          }

          if (pkgNamesToTarget.has(pkg.name as string)) {
            delete pkg.exports;
            delete pkg.module;
          }
          return pkg;
        },
      });
    } catch {
      // Try to use the defaultResolver with a packageFilter
      return options.defaultResolver(path, {
        ...options,
        packageFilter: (pkg) => ({
          ...pkg,
          main: pkg.main || pkg.es2015 || pkg.module,
        }),
        pathFilter: (pkg) => {
          if (!pkg.exports) {
            return path;
          }

          return resolveExports(pkg, path) || path;
        },
      });
    }
  } catch (e) {
    if (
      path === 'jest-sequencer-@jest/test-sequencer' ||
      path === '@jest/test-sequencer'
    ) {
      return;
    }
    // Fallback to using typescript
    ts = ts || require('typescript');
    compilerSetup = compilerSetup || getCompilerSetup(options.rootDir);
    const { compilerOptions, host } = compilerSetup;
    return ts.resolveModuleName(path, options.basedir, compilerOptions, host)
      .resolvedModule.resolvedFileName;
  }
};
