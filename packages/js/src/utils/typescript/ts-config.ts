import { offsetFromRoot, Tree, updateJson, workspaceRoot } from '@nx/devkit';
import { existsSync, readFileSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import type * as ts from 'typescript';
import { ensureTypescript } from './ensure-typescript';

let tsModule: typeof import('typescript');

export function readTsConfig(
  tsConfigPath: string,
  sys?: ts.System
): ts.ParsedCommandLine {
  if (!tsModule) {
    tsModule = require('typescript');
  }

  sys ??= tsModule.sys;

  const readResult = tsModule.readConfigFile(tsConfigPath, sys.readFile);
  return tsModule.parseJsonConfigFileContent(
    readResult.config,
    sys,
    dirname(tsConfigPath)
  );
}

export function readTsConfigFromTree(
  tree: Tree,
  tsConfigPath: string
): ts.ParsedCommandLine {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const tsSysFromTree: ts.System = {
    ...tsModule.sys,
    readFile: (path) => tree.read(path, 'utf-8'),
  };

  return readTsConfig(tsConfigPath, tsSysFromTree);
}

export function getRootTsConfigPathInTree(tree: Tree): string | null {
  for (const path of ['tsconfig.base.json', 'tsconfig.json']) {
    if (tree.exists(path)) {
      return path;
    }
  }

  return 'tsconfig.base.json';
}

export function getRelativePathToRootTsConfig(
  tree: Tree,
  targetPath: string
): string {
  return offsetFromRoot(targetPath) + getRootTsConfigPathInTree(tree);
}

export function getRootTsConfigPath(): string | null {
  const tsConfigFileName = getRootTsConfigFileName();

  return tsConfigFileName ? join(workspaceRoot, tsConfigFileName) : null;
}

export function getRootTsConfigFileName(tree?: Tree): string | null {
  for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
    const pathExists = tree
      ? tree.exists(tsConfigName)
      : existsSync(join(workspaceRoot, tsConfigName));

    if (pathExists) {
      return tsConfigName;
    }
  }

  return null;
}

export function addTsConfigPath(
  tree: Tree,
  importPath: string,
  lookupPaths: string[]
) {
  updateJson(tree, getRootTsConfigPathInTree(tree), (json) => {
    json.compilerOptions ??= {};
    const c = json.compilerOptions;
    c.paths ??= {};

    if (c.paths[importPath]) {
      throw new Error(
        `You already have a library using the import path "${importPath}". Make sure to specify a unique one.`
      );
    }

    c.paths[importPath] = lookupPaths.map(ensureRelativePath);

    return json;
  });
}

function ensureRelativePath(p: string): string {
  if (p.startsWith('./') || p.startsWith('../') || p.startsWith('/')) {
    return p;
  }
  return `./${p}`;
}

/**
 * When `baseUrl` is not set and `paths` are inherited via `extends`,
 * tools like `tsconfig-paths` resolve from the loaded file's directory
 * instead of the file where `paths` is defined. This walks the `extends`
 * chain to find the correct resolution base.
 *
 * Returns the directory that `paths` values should be resolved relative to.
 * Walks the tsconfig `extends` chain to find where `paths` is defined, then
 * looks for the applicable `baseUrl` from that point toward the root of the
 * chain (ignoring child overrides that don't apply to the paths-defining
 * tsconfig). When no `baseUrl` applies, returns the directory of the
 * tsconfig that defines `paths`.
 */
export function resolvePathsBaseUrl(tsconfigPath: string): string {
  const chain: { dir: string; raw: any }[] = [];
  const queue: string[] = [tsconfigPath];
  while (queue.length > 0) {
    const absolute = resolve(queue.shift()!);
    const dir = dirname(absolute);
    try {
      const raw = JSON.parse(readFileSync(absolute, 'utf-8'));
      chain.push({ dir, raw });
      const exts: string[] = raw.extends
        ? Array.isArray(raw.extends)
          ? raw.extends
          : [raw.extends]
        : [];
      for (const ext of exts) {
        const resolved = resolveExtendsPath(ext, dir);
        if (resolved) {
          queue.push(resolved);
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  // Find where paths is defined.
  let pathsIndex = -1;
  for (let i = 0; i < chain.length; i++) {
    if (
      chain[i].raw.compilerOptions?.paths &&
      Object.keys(chain[i].raw.compilerOptions.paths).length > 0
    ) {
      pathsIndex = i;
      break;
    }
  }

  // Find the applicable baseUrl: search from the paths-defining tsconfig
  // toward the root. Child overrides before the paths-defining tsconfig
  // are ignored — they don't apply to the paths that were written for a
  // different baseUrl context.
  const searchStart = pathsIndex >= 0 ? pathsIndex : 0;
  for (let i = searchStart; i < chain.length; i++) {
    if (chain[i].raw.compilerOptions?.baseUrl) {
      return resolve(chain[i].dir, chain[i].raw.compilerOptions.baseUrl);
    }
  }

  return pathsIndex >= 0
    ? chain[pathsIndex].dir
    : dirname(resolve(tsconfigPath));
}

/**
 * Resolves a tsconfig `extends` entry to an absolute path.
 * Handles relative paths, absolute paths, and package names
 * (e.g., `@tsconfig/node20/tsconfig.json` or `@tsconfig/strictest`).
 * Mirrors TypeScript's resolution: relative/absolute paths are resolved
 * directly (with `.json` fallback), package names use `require.resolve`
 * with a `tsconfig.json` fallback for bare package names.
 */
function resolveExtendsPath(ext: string, fromDir: string): string | null {
  if (ext.startsWith('.') || isAbsolute(ext)) {
    let resolved = resolve(fromDir, ext);
    if (existsSync(resolved)) return resolved;
    if (!resolved.endsWith('.json')) {
      resolved += '.json';
      if (existsSync(resolved)) return resolved;
    }
    return null;
  }
  // Package name — try as-is, then with /tsconfig.json appended
  try {
    return require.resolve(ext, { paths: [fromDir] });
  } catch {
    try {
      return require.resolve(`${ext}/tsconfig.json`, { paths: [fromDir] });
    } catch {
      return null;
    }
  }
}

export function readTsConfigPaths(tsConfig?: string | ts.ParsedCommandLine) {
  tsConfig ??= getRootTsConfigPath();
  try {
    if (!tsModule) {
      tsModule = ensureTypescript();
    }

    let config: ts.ParsedCommandLine;

    if (typeof tsConfig === 'string') {
      const configFile = tsModule.readConfigFile(
        tsConfig,
        tsModule.sys.readFile
      );
      config = tsModule.parseJsonConfigFileContent(
        configFile.config,
        tsModule.sys,
        dirname(tsConfig)
      );
    } else {
      config = tsConfig;
    }
    if (config.options?.paths) {
      return config.options.paths;
    } else {
      return null;
    }
  } catch (e) {
    return null;
  }
}
