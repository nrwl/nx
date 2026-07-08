import {
  offsetFromRoot,
  readJsonFile,
  Tree,
  updateJson,
  workspaceRoot,
} from '@nx/devkit';
import { existsSync, readFileSync, statSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import type * as ts from 'typescript';
import { ensureTypescript } from './ensure-typescript';

let tsModule: typeof import('typescript');

export function readTsConfig(
  tsConfigPath: string,
  sys?: ts.ParseConfigHost
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

/**
 * The subset of a TypeScript host that `createTreeParseConfigHost` backs with
 * the `Tree`. Deliberately narrower than `ts.System`, whose other members
 * (`realpath`, `getDirectories`, `writeFile`, ...) are disk-backed and would
 * silently escape the tree if a caller reached for them.
 */
export type TreeParseConfigHost = Pick<
  ts.ParseConfigHost,
  | 'useCaseSensitiveFileNames'
  | 'readDirectory'
  | 'readFile'
  | 'fileExists'
  | 'directoryExists'
>;

/**
 * A TypeScript host, backed by the devkit `Tree`, that resolves `extends` the
 * way real `tsc` does. The naive `{ ...ts.sys, readFile: (p) => tree.read(p) }`
 * host resolves less than `tsc`:
 *  - A package-form `extends` (e.g. `@tsconfig/node14/tsconfig.json`) is
 *    realpath-absolutized by TypeScript; `Tree.read`/`Tree.exists` re-root an
 *    absolute path under the workspace, so the base reads as nothing and its
 *    options silently vanish from the merged result (the failure surfaces only
 *    as a TS5083/TS6053 in `errors`, which callers discard).
 *  - An extension-less / directory-form `extends` resolves against
 *    `process.cwd()` when existence comes from `ts.sys`; Nx never chdirs to the
 *    workspace root, so it resolves only when the command runs from the root.
 *
 * This host maps absolute paths under `tree.root` back to tree-relative for the
 * tree lookups, falls through to `fs` for paths that resolve outside the
 * workspace (a pnpm store or a `link:`/`file:` target), and answers existence
 * from the tree so resolution is cwd-independent.
 *
 * `readDirectory` is a no-op: the source-file scan is skipped because callers
 * read only the merged `options`, never the file list. A config that resolves
 * its inputs through `include` (or the default glob) then reports a TS18003, so
 * `errors.length > 0` is not a usable signal; match specific codes
 * (TS5083/TS6053) instead.
 */
export function createTreeParseConfigHost(tree: Tree): TreeParseConfigHost {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const isOutsideRoot = (path: string) =>
    isAbsolute(path) && !path.startsWith(tree.root);
  const toTreePath = (path: string) =>
    path.startsWith(tree.root) ? relative(tree.root, path) || '.' : path;
  // `ts.sys` gates `readFile`/`fileExists` on `isFile`, so a directory is never
  // read as a config file. Both branches mirror that, which lets an
  // extension-less `extends` ("./config") that collides with a same-named
  // directory fall through to its `.json` sibling. Out-of-root, a bare
  // `existsSync` answers true for a directory and `readFileSync` on it throws
  // EISDIR (TS5012, which the extends-failure guard does not catch); in-root,
  // `tree.exists` also answers true for a directory, so `fileExists` gates on
  // `tree.isFile`.
  const isFileOnDisk = (path: string) => {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  };

  return {
    ...tsModule.sys,
    readDirectory: () => [],
    readFile: (path) =>
      isOutsideRoot(path)
        ? isFileOnDisk(path)
          ? readFileSync(path, 'utf-8')
          : undefined
        : (tree.read(toTreePath(path), 'utf-8') ?? undefined),
    fileExists: (path) => {
      if (isOutsideRoot(path)) {
        return isFileOnDisk(path);
      }
      const treePath = toTreePath(path);
      return tree.exists(treePath) && tree.isFile(treePath);
    },
    directoryExists: (path) => {
      if (isOutsideRoot(path)) {
        return existsSync(path) && statSync(path).isDirectory();
      }
      const treePath = toTreePath(path);
      return tree.exists(treePath) && !tree.isFile(treePath);
    },
  };
}

/**
 * Whether a `ParsedCommandLine` produced with `createTreeParseConfigHost` failed
 * to resolve an `extends` target: TS5083 (the base resolved but could not be
 * read) or TS6053 (the base could not be resolved at all). Because the host
 * resolves what real `tsc` resolves, this only fires for a config whose extends
 * chain `tsc` cannot read either. The no-op `readDirectory` also adds a TS18003
 * whenever the config resolves inputs through `include`, so `errors.length > 0`
 * is not a usable signal; match these two codes.
 */
export function extendsResolutionFailed(
  errors: readonly ts.Diagnostic[]
): boolean {
  // 5083: Cannot read file '{0}'. 6053: File '{0}' not found.
  return errors.some((error) => error.code === 5083 || error.code === 6053);
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
      const raw = readJsonFile(absolute);
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
    let config: ts.ParsedCommandLine;

    if (typeof tsConfig === 'string') {
      if (!tsModule) {
        tsModule = ensureTypescript();
      }

      const configFile = tsModule.readConfigFile(
        tsConfig,
        tsModule.sys.readFile
      );
      // Stub `readDirectory` to skip the source-file scan — only `paths` is consumed.
      const parseConfigHost: ts.ParseConfigHost = {
        ...tsModule.sys,
        readDirectory: () => [],
      };
      config = tsModule.parseJsonConfigFileContent(
        configFile.config,
        parseConfigHost,
        dirname(tsConfig)
      );
    } else {
      config = tsConfig;
    }
    return config.options?.paths ?? null;
  } catch (e) {
    return null;
  }
}
