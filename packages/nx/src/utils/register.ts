import { join } from 'path';

/**
 * Optionally, if swc-node and tsconfig-paths are available in the current workspace, apply the require
 * register hooks so that .ts files can be used for writing custom workspace projects.
 *
 * If ts-node and tsconfig-paths are not available, the user can still provide an index.js file in
 * the root of their project and the fundamentals will still work (but
 * workspace path mapping will not, for example).
 */
export const registerTsProject = (
  path: string,
  configFilename = 'tsconfig.json'
) => {
  // These are requires to prevent it from registering when it shouldn't
  const { register } = require('@swc-node/register/register');
  const {
    readDefaultTsConfig,
  } = require('@swc-node/register/read-default-tsconfig');

  try {
    const tsConfigPath = join(path, configFilename);
    const tsConfig = readDefaultTsConfig(tsConfigPath);
    register(tsConfig);

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
  } catch (err) {}
  return () => {};
};
