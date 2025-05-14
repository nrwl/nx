import * as metroResolver from 'metro-resolver';
import type { MatchPath } from 'tsconfig-paths';
import { createMatchPath, loadConfig } from 'tsconfig-paths';
import * as pc from 'picocolors';
import { CachedInputFileSystem, ResolverFactory } from 'enhanced-resolve';
import { dirname, join } from 'path';
import * as fs from 'fs';
import { workspaceRoot } from '@nx/devkit';

/*
 * Use tsconfig to resolve additional workspace libs.
 *
 * This resolve function requires projectRoot to be set to
 * workspace root in order modules and assets to be registered and watched.
 */
export function getResolveRequest(
  extensions: string[],
  exportsConditionNames: string[] = [],
  mainFields: string[] = []
) {
  return function (
    _context: any,
    realModuleName: string,
    platform: string | null
  ) {
    const debug = process.env.NX_REACT_NATIVE_DEBUG === 'true';

    const { resolveRequest, ...context } = _context;

    const resolvedPath =
      resolveRequestFromContext(
        resolveRequest,
        _context,
        realModuleName,
        platform,
        debug
      ) ??
      defaultMetroResolver(context, realModuleName, platform, debug) ??
      tsconfigPathsResolver(
        context,
        extensions,
        realModuleName,
        platform,
        debug
      ) ??
      pnpmResolver(
        extensions,
        context,
        realModuleName,
        debug,
        exportsConditionNames,
        mainFields
      );
    if (resolvedPath) {
      return resolvedPath;
    }
    if (debug) {
      console.log(
        pc.red(`[Nx] Unable to resolve with any resolver: ${realModuleName}`)
      );
    }
    throw new Error(`Cannot resolve ${pc.bold(realModuleName)}`);
  };
}

function resolveRequestFromContext(
  resolveRequest: Function,
  context: any,
  realModuleName: string,
  platform: string | null,
  debug: boolean
) {
  try {
    return resolveRequest(context, realModuleName, platform);
  } catch {
    if (debug)
      console.log(
        pc.cyan(
          `[Nx] Unable to resolve with default resolveRequest: ${realModuleName}`
        )
      );
  }
}

/**
 * This function try to resolve path using metro's default resolver
 * @returns path if resolved, else undefined
 */
function defaultMetroResolver(
  context: any,
  realModuleName: string,
  platform: string | null,
  debug: boolean
) {
  try {
    return metroResolver.resolve(context, realModuleName, platform);
  } catch {
    if (debug)
      console.log(
        pc.cyan(
          `[Nx] Unable to resolve with default Metro resolver: ${realModuleName}`
        )
      );
  }
}

/**
 * This resolver try to resolve module for pnpm.
 * @returns path if resolved, else undefined
 * This pnpm resolver is inspired from https://github.com/vjpr/pnpm-react-native-example/blob/main/packages/pnpm-expo-helper/util/make-resolver.js
 */
function pnpmResolver(
  extensions: string[],
  context: any,
  realModuleName: string,
  debug: boolean,
  exportsConditionNames: string[] = [],
  mainFields: string[] = []
) {
  try {
    const pnpmResolve = getPnpmResolver(extensions);
    const lookupStartPath = dirname(context.originModulePath);
    const filePath = pnpmResolve.resolveSync(
      {},
      lookupStartPath,
      realModuleName
    );
    if (filePath) {
      return { type: 'sourceFile', filePath };
    }
  } catch {
    if (debug)
      console.log(
        pc.cyan(
          `[Nx] Unable to resolve with default PNPM resolver: ${realModuleName}`
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
  platform: string | null,
  debug: boolean
) {
  try {
    const tsConfigPathMatcher = getMatcher(debug);
    const match = tsConfigPathMatcher(
      realModuleName,
      undefined,
      undefined,
      extensions.map((ext) => `.${ext}`)
    );
    return metroResolver.resolve(context, match, platform);
  } catch {
    if (debug) {
      console.log(pc.cyan(`[Nx] Failed to resolve ${pc.bold(realModuleName)}`));
      console.log(
        pc.cyan(
          `[Nx] The following tsconfig paths was used:\n:${pc.bold(
            JSON.stringify(paths, null, 2)
          )}`
        )
      );
    }
  }
}

let matcher: MatchPath;
let absoluteBaseUrl: string;
let paths: Record<string, string[]>;

function getMatcher(debug: boolean) {
  if (!matcher) {
    const result = loadConfig();
    if (result.resultType === 'success') {
      absoluteBaseUrl = result.absoluteBaseUrl;
      paths = result.paths;
      if (debug) {
        console.log(
          pc.cyan(`[Nx] Located tsconfig at ${pc.bold(absoluteBaseUrl)}`)
        );
        console.log(
          pc.cyan(
            `[Nx] Found the following paths:\n:${pc.bold(
              JSON.stringify(paths, null, 2)
            )}`
          )
        );
      }
      matcher = createMatchPath(absoluteBaseUrl, paths);
    } else {
      console.log(pc.cyan(`[Nx] Failed to locate tsconfig}`));
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
function getPnpmResolver(
  extensions: string[],
  exportsConditionNames: string[] = [],
  mainFields: string[] = []
) {
  if (!resolver) {
    const fileSystem = new CachedInputFileSystem(fs, 4000);
    resolver = ResolverFactory.createResolver({
      fileSystem,
      extensions: extensions.map((extension) => '.' + extension),
      useSyncFileSystemCalls: true,
      modules: [join(workspaceRoot, 'node_modules'), 'node_modules'],
      conditionNames: [
        'native',
        'browser',
        'require',
        'default',
        'react-native',
        'node',
        ...exportsConditionNames,
      ],
      mainFields: ['react-native', 'browser', 'main', ...mainFields],
      aliasFields: ['browser'],
    });
  }
  return resolver;
}
