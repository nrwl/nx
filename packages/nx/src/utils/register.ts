import { readDefaultTsConfig } from '@swc-node/register/read-default-tsconfig';
import { register } from '@swc-node/register/register';
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
  try {
    const tsConfig = readDefaultTsConfig(join(path, configFilename));
    register(tsConfig);

    /**
     * Load the ts config from the source project
     */
    const tsconfigPaths = require('tsconfig-paths');
    const tsConfigResult = tsconfigPaths.loadConfig(path);
    /**
     * Register the custom workspace path mappings with node so that workspace libraries
     * can be imported and used within project
     */
    return tsconfigPaths.register({
      baseUrl: tsConfigResult.absoluteBaseUrl,
      paths: tsConfigResult.paths,
    });
  } catch (err) {}
};
