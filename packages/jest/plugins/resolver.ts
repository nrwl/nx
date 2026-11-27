import { statSync } from 'fs';
import { dirname, extname, join, resolve } from 'path';
import { resolve as resolveExports } from 'resolve.exports';
import type { ResolverOptions } from 'jest-resolve';
import { getVersion } from 'jest';
import { major } from 'semver';

let resolveTsModule: (
  moduleName: string,
  containingFile: string
) => string | undefined;
const jestMajorVersion = major(getVersion());

function createTsResolverForRootDir(rootDir: string) {
  const tsConfigPath =
    findConfigFile(rootDir, 'tsconfig.spec.json') ||
    findConfigFile(rootDir, 'tsconfig.test.json') ||
    findConfigFile(rootDir, 'tsconfig.jest.json') ||
    findConfigFile(rootDir, 'tsconfig.json');

  if (!tsConfigPath) {
    console.error(
      `Cannot locate a tsconfig.spec.json. Please create one at ${rootDir}/tsconfig.spec.json`
    );
  }

  const devkitInternal: typeof import('@nx/devkit/internal') = require('@nx/devkit/internal');
  const compilerOptions =
    devkitInternal.readTsConfigWithoutFiles(tsConfigPath).options;
  if (!compilerOptions.baseUrl) {
    const { resolvePathsBaseUrl } = require('@nx/js');
    compilerOptions.baseUrl = resolvePathsBaseUrl(tsConfigPath);
  }
  return devkitInternal.createTsModuleResolver(compilerOptions);
}

// Searches `dir` and its ancestors, like `ts.findConfigFile`.
function findConfigFile(dir: string, configName: string): string | undefined {
  while (true) {
    const configPath = join(dir, configName);
    if (isFile(configPath)) {
      return configPath;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
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
    resolveTsModule ??= createTsResolverForRootDir(options.rootDir);
    const resolvedFileName = resolveTsModule(
      path,
      join(options.basedir, 'fake-placeholder.ts')
    );
    if (!resolvedFileName) {
      throw new Error(`Could not resolve ${path}`);
    }
    return resolve(options.rootDir, resolvedFileName);
  }
};
