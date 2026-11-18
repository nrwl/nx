import { createRequire } from 'module';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'path';
import { isTrustedNxInstall, workspaceRoot } from './workspace-root';

export function getNxInstallationPath(root: string = workspaceRoot) {
  return join(root, '.nx', 'installation');
}

export function getNxRequirePaths(root: string = workspaceRoot) {
  return [getNxInstallationPath(root), root];
}

/**
 * Resolves a package the workspace provides (typescript, a release version
 * actions implementation, ...) from the workspace first, then from this nx
 * installation. A package manager's global or content-addressed store links nx
 * only to its own dependencies, so resolving from nx's location alone cannot
 * see what the workspace installs.
 */
export function resolveFromWorkspace(
  specifier: string,
  root: string = workspaceRoot
): string {
  return resolveInstalledPackage(
    specifier,
    [...getNxRequirePaths(root), __dirname],
    root
  );
}

const nodeModulesSegment = `${sep}node_modules${sep}`;

let nxInstallationRoots: string[] | undefined;

/**
 * The directories whose `node_modules` hold this nx and its own dependencies,
 * e.g. the workspace, a global prefix, or the nx repo when run from source.
 */
function getNxInstallationRoots(): string[] {
  nxInstallationRoots ??= installationRootsOf([
    __dirname,
    require.resolve('yargs'),
  ]);
  return nxInstallationRoots;
}

/**
 * The directory holding the outermost `node_modules` of each path. The
 * separator is kept so `/node_modules` yields `/`, not an empty path.
 */
export function installationRootsOf(paths: string[]): string[] {
  return paths
    .filter((path) => path.includes(nodeModulesSegment))
    .map((path) =>
      resolve(path.slice(0, path.indexOf(nodeModulesSegment) + 1))
    );
}

function normalize(path: string): string {
  const resolved = resolve(path);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isInside(path: string, dir: string): boolean {
  return path === dir || path.startsWith(dir.endsWith(sep) ? dir : dir + sep);
}

/**
 * `require.resolve(specifier, { paths })` limited to `node_modules`
 * directories inside `root`, the workspace, or this nx installation.
 */
export function resolveInstalledPackage(
  specifier: string,
  paths: string[],
  root: string = workspaceRoot
): string {
  if (
    process.versions.pnp ||
    specifier.startsWith('.') ||
    isAbsolute(specifier)
  ) {
    return require.resolve(specifier, { paths });
  }

  const trustedRoots = [root, workspaceRoot, ...getNxInstallationRoots()].map(
    normalize
  );
  const lookupPaths = new Set<string>();
  for (const start of paths) {
    let dir = resolve(start);
    while (trustedRoots.some((r) => isInside(normalize(dir), r))) {
      if (basename(dir) !== 'node_modules') {
        lookupPaths.add(join(dir, 'node_modules'));
      }
      if (dirname(dir) === dir) {
        break;
      }
      dir = dirname(dir);
    }
  }

  const Module = require('node:module');
  const resolved: string | false = Module._findPath(specifier, [
    ...lookupPaths,
  ]);
  if (!resolved) {
    throw Object.assign(new Error(`Cannot find module '${specifier}'`), {
      code: 'MODULE_NOT_FOUND',
    });
  }
  return resolved;
}

/**
 * Resolves `nx/bin/nx.js` from the first `node_modules` Node searches from `dir`
 * that holds it, refusing it when it fails `isTrustedNxInstall` for the
 * workspace at `root`.
 */
export function resolveNxBinFrom(dir: string, root: string = dir): string {
  // createRequire avoids nx's own exports field answering by self-reference.
  const dirRequire = createRequire(join(dir, 'package.json'));
  if (process.versions.pnp) {
    return dirRequire.resolve('nx/bin/nx.js');
  }

  const Module = require('node:module');
  for (const nodeModules of dirRequire.resolve.paths('nx') ?? []) {
    const nxBin: string | false = Module._findPath('nx/bin/nx.js', [
      nodeModules,
    ]);
    if (!nxBin) {
      continue;
    }
    if (!isTrustedNxInstall(nodeModules, root)) {
      throw new Error(`Refusing the nx installed in ${nodeModules}`);
    }
    return nxBin;
  }
  throw Object.assign(new Error(`Cannot find module 'nx/bin/nx.js'`), {
    code: 'MODULE_NOT_FOUND',
  });
}
