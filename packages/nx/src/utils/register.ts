import { join } from 'path';
import { logger, NX_PREFIX, stripIndent } from './logger';

/**
 * Optionally, if swc-node and tsconfig-paths are available in the current workspace, apply the require
 * register hooks so that .ts files can be used for writing custom workspace projects.
 *
 * If ts-node and tsconfig-paths are not available, the user can still provide an index.js file in
 * the root of their project and the fundamentals will still work (but
 * workspace path mapping will not, for example).
 *
 * @returns cleanup function
 */
export const registerTsProject = (
  path: string,
  configFilename = 'tsconfig.json'
): (() => void) => {
  const cleanupFunctions: (() => void)[] = [];

  // Function to register transpiler that returns cleanup function
  let registerTranspiler: () => () => void;

  const tsConfigPath = join(path, configFilename);
  cleanupFunctions.push(registerTsConfigPaths(tsConfigPath));

  const swcNodeInstalled = packageIsInstalled('@swc-node/register');
  if (swcNodeInstalled) {
    // These are requires to prevent it from registering when it shouldn't
    const { register } =
      require('@swc-node/register/register') as typeof import('@swc-node/register/register');
    const {
      readDefaultTsConfig,
    } = require('@swc-node/register/read-default-tsconfig');

    const tsConfig = readDefaultTsConfig(tsConfigPath);
    registerTranspiler = () => register(tsConfig);
  } else {
    // We can fall back on ts-node if its available
    const tsNodeInstalled = packageIsInstalled('ts-node/register');
    if (tsNodeInstalled) {
      warnTsNodeUsage();
      const { register } = require('ts-node') as typeof import('ts-node');

      // ts-node doesn't provide a cleanup method
      registerTranspiler = () => {
        register({
          project: tsConfigPath,
          transpileOnly: true,
          compilerOptions: {
            module: 'commonjs',
          },
        });
        return () => {};
      };
    }
  }

  if (registerTranspiler) {
    cleanupFunctions.push(registerTranspiler());
  } else {
    warnNoTranspiler();
  }

  // Overall cleanup method cleans up tsconfig path resolution
  // as well as ts transpiler
  return () => {
    for (const f of cleanupFunctions) {
      f();
    }
  };
};

/**
 * @param tsConfigPath Adds the paths from a tsconfig file into node resolutions
 * @returns cleanup function
 */
export function registerTsConfigPaths(tsConfigPath): () => void {
  try {
    /**
     * Load the ts config from the source project
     */
    const tsconfigPaths: typeof import('tsconfig-paths') = require('tsconfig-paths');
    const tsConfigResult = tsconfigPaths.loadConfig(tsConfigPath);
    /**
     * Register the custom workspace path mappings with node so that workspace libraries
     * can be imported and used within project
     */
    if (tsConfigResult.resultType === 'success') {
      return tsconfigPaths.register({
        baseUrl: tsConfigResult.absoluteBaseUrl,
        paths: tsConfigResult.paths,
      });
    }
  } catch (err) {
    warnNoTsconfigPaths();
  }
  return () => {};
}

function warnTsNodeUsage() {
  logger.warn(
    stripIndent(`${NX_PREFIX} Falling back to ts-node for local typescript execution. This may be a little slower.
  - To fix this, ensure @swc-node/register and @swc/core have been installed`)
  );
}

function warnNoTsconfigPaths() {
  logger.warn(
    stripIndent(`${NX_PREFIX} Unable to load tsconfig-paths, workspace libraries may be inaccessible.
  - To fix this, install tsconfig-paths with npm/yarn/pnpm`)
  );
}

function warnNoTranspiler() {
  logger.warn(
    stripIndent(`${NX_PREFIX} Unable to locate swc-node or ts-node. Nx will be unable to run local ts files without transpiling.
  - To fix this, ensure @swc-node/register and @swc/core have been installed`)
  );
}

function packageIsInstalled(m: string) {
  try {
    const p = require.resolve(m);
    return true;
  } catch {
    return false;
  }
}
