import { basename, dirname, isAbsolute, join, resolve, sep } from 'path';
import { workspaceRoot } from './workspace-root';

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
  nxInstallationRoots ??= [__dirname, require.resolve('yargs')]
    .filter((path) => path.includes(nodeModulesSegment))
    .map((path) => path.slice(0, path.indexOf(nodeModulesSegment)));
  return nxInstallationRoots;
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
