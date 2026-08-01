import { workspaceRoot } from '@nx/devkit';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'path';

// Cache for metro-config module
let metroConfig: any = null;

/**
 * Lazily require the Metro config helpers.
 *
 * Expo SDK 55+ ships Metro through the `@expo/metro` package family, so the
 * `mergeConfig` used here must come from the same Metro instance that
 * `@expo/metro-config`'s `getDefaultConfig` is built against. Older SDKs
 * (53/54) use the standalone `metro-config` package. We prefer `@expo/metro`
 * and fall back to the standalone package to stay compatible with both.
 */
function getMetroConfig() {
  if (!metroConfig) {
    try {
      metroConfig = require('@expo/metro/metro-config');
    } catch {
      try {
        metroConfig = require('metro-config');
      } catch (error) {
        throw new Error(
          'Unable to load Metro config. Install `@expo/metro` (Expo SDK 55+) or `metro-config` (>= 0.82.0).'
        );
      }
    }
  }
  return metroConfig;
}

type MetroConfig = any; // We'll use any to avoid importing the type

import { getResolveRequest } from './metro-resolver';

interface WithNxOptions {
  /**
   * Change this to true to see debugging info.
   */
  debug?: boolean;
  /**
   * A list of additional file extensions to resolve
   * All the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx', 'json'
   */
  extensions?: string[];
  /**
   * A list of additional folders to watch for changes
   * By default, it watches all the folders in the workspace root except 'dist' and 'e2e'
   */
  watchFolders?: string[];
  /*
   * A list of exports field condition names in node_modules libraries' package.json
   * If a library has a package.json with an exports field, but it can't be resolved with the default conditions, you can add the name of the condition to this list.
   */
  exportsConditionNames?: string[];
  /**
   * A list of main fields in package.json files to use for resolution
   * If a library has a package.json with a main field that can't be resolved with the default conditions, you can add the name of the field to this list.
   */
  mainFields?: string[];
}

export function withNxMetro(userConfig: MetroConfig, opts: WithNxOptions = {}) {
  const extensions = ['', 'ts', 'tsx', 'js', 'jsx', 'json'];
  if (opts.debug) process.env.NX_REACT_NATIVE_DEBUG = 'true';
  if (opts.extensions) extensions.push(...opts.extensions);

  let watchFolders = readdirSync(workspaceRoot)
    .filter(
      (fileName) =>
        !['dist', 'e2e'].includes(fileName) && !fileName.startsWith('.')
    )
    .map((fileName) => join(workspaceRoot, fileName))
    .filter((filePath) => statSync(filePath).isDirectory());

  if (opts.watchFolders?.length) {
    watchFolders = watchFolders.concat(opts.watchFolders);
  }

  watchFolders = [...new Set(watchFolders)].filter((folder) =>
    existsSync(folder)
  );

  // Expo SDK 55+ ships Metro via `@expo/metro` and resolves the project's
  // Babel config relative to `projectRoot`. Forcing `projectRoot` to the
  // workspace root breaks that lookup, because the app's `.babelrc.js` lives in
  // the project directory, not the workspace root (Metro's babel transformer
  // does `path.resolve(projectRoot, '.babelrc.js')`). So only override
  // `projectRoot` for older SDKs (53/54). Workspace libraries remain resolvable
  // via `watchFolders`, `nodeModulesPaths`, and the custom `resolveRequest`.
  // `@expo/metro` has no root entry point (only subpath exports), so resolve a
  // known subpath to detect it — `require.resolve('@expo/metro')` would throw
  // ERR_PACKAGE_PATH_NOT_EXPORTED even when the package is installed.
  let usesExpoMetro = false;
  try {
    require.resolve('@expo/metro/metro-config');
    usesExpoMetro = true;
  } catch {}

  const nxConfig: MetroConfig = {
    ...(usesExpoMetro ? {} : { projectRoot: workspaceRoot }),
    resolver: {
      resolveRequest: getResolveRequest(
        extensions,
        opts.exportsConditionNames,
        opts.mainFields
      ),
      nodeModulesPaths: [join(workspaceRoot, 'node_modules')],
    },
    watchFolders,
  };

  const { mergeConfig } = getMetroConfig();
  return mergeConfig(userConfig, nxConfig);
}
