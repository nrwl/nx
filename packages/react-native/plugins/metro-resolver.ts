import * as metroResolver from 'metro-resolver';
import type { MatchPath } from 'tsconfig-paths';
import { createMatchPath, loadConfig } from 'tsconfig-paths';
import * as chalk from 'chalk';
import { detectPackageManager } from '@nrwl/devkit';
import { CachedInputFileSystem, ResolverFactory } from 'enhanced-resolve';
import { dirname, join } from 'path';
import * as fs from 'fs';
import { appRootPath } from 'nx/src/utils/app-root';

/*
 * Use tsconfig to resolve additional workspace libs.
 *
 * This resolve function requires projectRoot to be set to
 * workspace root in order modules and assets to be registered and watched.
 */
export function getResolveRequest(extensions: string[]) {
  return function (
    _context: any,
    realModuleName: string,
    platform: string | null,
    moduleName: string
  ) {
    const DEBUG = process.env.NX_REACT_NATIVE_DEBUG === 'true';

    if (DEBUG) console.log(chalk.cyan(`[Nx] Resolving: ${moduleName}`));

    const { resolveRequest, ...context } = _context;

    let resolvedPath = defaultMetroResolver(context, moduleName, platform);
    if (resolvedPath) {
      return resolvedPath;
    }

    resolvedPath = pnpmResolver(
      extensions,
      context,
      realModuleName,
      moduleName
    );
    if (resolvedPath) {
      return resolvedPath;
    }

    return tsconfigPathsResolver(
      context,
      extensions,
      realModuleName,
      moduleName,
      platform
    );
  };
}

/**
 * This function try to resolve path using metro's default resolver
 * @returns path if resolved, else undefined
 */
function defaultMetroResolver(
  context: any,
  moduleName: string,
  platform: string
) {
  const DEBUG = process.env.NX_REACT_NATIVE_DEBUG === 'true';
  try {
    return metroResolver.resolve(context, moduleName, platform);
  } catch {
    if (DEBUG)
      console.log(
        chalk.cyan(
          `[Nx] Unable to resolve with default Metro resolver: ${moduleName}`
        )
      );
  }
}

/**
 * This resolver try to resolve module for pnpm.
 * @returns path if resolved, else undefined
 * This pnpm resolver is inspired from https://github.com/vjpr/pnpm-react-native-example/blob/main/packages/pnpm-expo-helper/util/make-resolver.js
 */
function pnpmResolver(extensions, context, realModuleName, moduleName) {
  const DEBUG = process.env.NX_REACT_NATIVE_DEBUG === 'true';
  try {
    const pnpmResolver = getPnpmResolver(appRootPath, extensions);
    const lookupStartPath = dirname(context.originModulePath);
    const filePath = pnpmResolver.resolveSync(
      {},
      lookupStartPath,
      realModuleName
    );
    if (filePath) {
      return { type: 'sourceFile', filePath };
    }
  } catch {
    if (DEBUG)
      console.log(
        chalk.cyan(
          `[Nx] Unable to resolve with default PNPM resolver: ${moduleName}`
        )
      );
  }
}

/**
 * This function try to resolve files that are specified in tsconfig's paths
 * @returns path if resolved, else undefined
 */
function tsconfigPathsResolver(
  context: any,
  extensions: string[],
  realModuleName: string,
  moduleName: string,
  platform: string
) {
  const DEBUG = process.env.NX_REACT_NATIVE_DEBUG === 'true';
  const matcher = getMatcher();
  const match = matcher(
    realModuleName,
    undefined,
    undefined,
    extensions.map((ext) => `.${ext}`)
  );

  if (match) {
    return metroResolver.resolve(context, match, platform);
  } else {
    if (DEBUG) {
      console.log(
        chalk.red(`[Nx] Failed to resolve ${chalk.bold(moduleName)}`)
      );
      console.log(
        chalk.cyan(
          `[Nx] The following tsconfig paths was used:\n:${chalk.bold(
            JSON.stringify(paths, null, 2)
          )}`
        )
      );
    }
    throw new Error(`Cannot resolve ${chalk.bold(moduleName)}`);
  }
}

let matcher: MatchPath;
let absoluteBaseUrl: string;
let paths: Record<string, string[]>;

function getMatcher() {
  const DEBUG = process.env.NX_REACT_NATIVE_DEBUG === 'true';

  if (!matcher) {
    const result = loadConfig();
    if (result.resultType === 'success') {
      absoluteBaseUrl = result.absoluteBaseUrl;
      paths = result.paths;
      if (DEBUG) {
        console.log(
          chalk.cyan(`[Nx] Located tsconfig at ${chalk.bold(absoluteBaseUrl)}`)
        );
        console.log(
          chalk.cyan(
            `[Nx] Found the following paths:\n:${chalk.bold(
              JSON.stringify(paths, null, 2)
            )}`
          )
        );
      }
      matcher = createMatchPath(absoluteBaseUrl, paths);
    } else {
      console.log(chalk.cyan(`[Nx] Failed to locate tsconfig}`));
      throw new Error(`Could not load tsconfig for project`);
    }
  }
  return matcher;
}

/**
 * This function returns resolver for pnpm.
 * It is inspired form https://github.com/vjpr/pnpm-expo-example/blob/main/packages/pnpm-expo-helper/util/make-resolver.js.
 */
let resolver;
function getPnpmResolver(appRootPath: string, extensions: string[]) {
  if (!resolver) {
    const fileSystem = new CachedInputFileSystem(fs, 4000);
    resolver = ResolverFactory.createResolver({
      fileSystem,
      extensions: extensions.map((extension) => '.' + extension),
      useSyncFileSystemCalls: true,
      modules: [join(appRootPath, 'node_modules'), 'node_modules'],
    });
  }
  return resolver;
}
