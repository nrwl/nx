import { workspaceRoot } from '@nx/devkit';
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join } from 'path';

const metroConfigCache = new Map<string, any>();

// `mergeConfig` must come from the same Metro instance as the app's
// `getDefaultConfig`: `@expo/metro` on SDK 55+, standalone `metro-config` on
// 53/54. Resolve from the app root so each app gets its own SDK's copy.
function getMetroConfig(appRoot: string | undefined, usesExpoMetro: boolean) {
  const cacheKey = `${appRoot ?? ''}|${usesExpoMetro}`;
  let metroConfig = metroConfigCache.get(cacheKey);
  if (!metroConfig) {
    const candidates = usesExpoMetro
      ? ['@expo/metro/metro-config', 'metro-config']
      : ['metro-config', '@expo/metro/metro-config'];
    for (const candidate of candidates) {
      try {
        metroConfig = require(
          require.resolve(candidate, appRoot ? { paths: [appRoot] } : undefined)
        );
        break;
      } catch {}
    }
    if (!metroConfig) {
      throw new Error(
        'Unable to load Metro config. Install `@expo/metro` (Expo SDK 55+) or `metro-config` (>= 0.82.0).'
      );
    }
    metroConfigCache.set(cacheKey, metroConfig);
  }
  return metroConfig;
}

// SDK 55+ ships Metro through `@expo/metro`. Resolve `expo` from the app's
// own root: probing from this plugin's location reads whichever copy is
// hoisted, which can belong to a sibling app on a different SDK.
export function appUsesExpoMetro(appRoot: string | undefined): boolean {
  try {
    const expoPkgPath = require.resolve(
      'expo/package.json',
      appRoot ? { paths: [appRoot] } : undefined
    );
    return parseInt(require(expoPkgPath).version, 10) >= 55;
  } catch {
    // expo not resolvable; probe `@expo/metro` process-wide (no root entry
    // point, so resolve a known subpath)
    try {
      require.resolve('@expo/metro/metro-config');
      return true;
    } catch {
      return false;
    }
  }
}

function appOwnsExpo(appNodeModules: string): boolean {
  const appExpo = join(appNodeModules, 'expo');
  if (!existsSync(appExpo)) return false;
  const hoistedExpo = join(workspaceRoot, 'node_modules', 'expo');
  // no hoisted copy: the app-local one is the only expo, and Expo's HMR
  // rewrite resolves strictly from `projectRoot`, so anchor at the app
  if (!existsSync(hoistedExpo)) return true;
  return realpathSync(appExpo) !== realpathSync(hoistedExpo);
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

  // `getDefaultConfig(__dirname)` set this to the app directory
  const appRoot: string | undefined = userConfig.projectRoot;
  const usesExpoMetro = appUsesExpoMetro(appRoot);

  const appNodeModules = appRoot ? join(appRoot, 'node_modules') : null;
  const hasAppNodeModules = !!appNodeModules && existsSync(appNodeModules);
  // an app pinning its own `expo` must stay anchored at the app, or the
  // bundle picks up the hoisted copy alongside its own. Compare real paths:
  // `ensureNodeModulesSymlink` links the whole app node_modules to the
  // workspace's, which is not an app-owned copy.
  const ownsExpo = hasAppNodeModules && appOwnsExpo(appNodeModules);

  // SDK 55+ resolves Babel config and the HMR client relative to
  // `projectRoot`; SDK 53/54 apps relying on hoisted Expo need the workspace
  // root so `originModulePath` stays workspace-relative for the Nx resolver.
  const nxConfig: MetroConfig = {
    ...(usesExpoMetro || ownsExpo ? {} : { projectRoot: workspaceRoot }),
    resolver: {
      resolveRequest: getResolveRequest(
        extensions,
        opts.exportsConditionNames,
        opts.mainFields,
        { appRoot, usesExpoMetro }
      ),
      nodeModulesPaths: [
        ...(hasAppNodeModules ? [appNodeModules] : []),
        join(workspaceRoot, 'node_modules'),
      ],
    },
    watchFolders,
  };

  const { mergeConfig } = getMetroConfig(appRoot, usesExpoMetro);
  return mergeConfig(userConfig, nxConfig);
}
