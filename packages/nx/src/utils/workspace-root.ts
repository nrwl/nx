import * as path from 'path';
import { fileExists } from './fileutils';
import { isTrustedAncestorEntry } from './owned-private-dir';

const warnedUntrusted = new Set<string>();

/**
 * The root of the workspace
 */
export let workspaceRoot = workspaceRootInner(process.cwd(), process.cwd());

// Required for integration tests in projects which depend on Nx at runtime, such as lerna and angular-eslint
export function setWorkspaceRoot(root: string): void {
  workspaceRoot = root;
}

export function workspaceRootInner(
  dir: string,
  candidateRoot: string | null
): string {
  if (process.env.NX_WORKSPACE_ROOT_PATH)
    return process.env.NX_WORKSPACE_ROOT_PATH;
  if (path.dirname(dir) === dir) return candidateRoot;

  const matches = ['nx.json', 'nx', 'nx.bat'];

  if (
    matches.some(
      (x) => fileExists(path.join(dir, x)) && isTrustedWorkspaceEntry(dir, x)
    )
  ) {
    return dir;

    // This handles the case where we have a workspace which uses npm / yarn / pnpm
    // workspaces, and has a project which contains Nx in its dependency tree.
    // e.g. packages/my-lib/package.json contains @nx/devkit, which references Nx and is
    // thus located in //packages/my-lib/node_modules/nx/package.json
  } else if (
    fileExists(path.join(dir, 'node_modules', 'nx', 'package.json')) &&
    isTrustedNxInstall(path.join(dir, 'node_modules'), dir)
  ) {
    return workspaceRootInner(path.dirname(dir), dir);
  } else {
    return workspaceRootInner(path.dirname(dir), candidateRoot);
  }
}

/**
 * Whether a workspace marker found by walking up from the cwd may be used.
 * `NX_WORKSPACE_ROOT_PATH` vouches for its own entries.
 */
export function isTrustedWorkspaceEntry(dir: string, name: string): boolean {
  const explicitRoot = process.env.NX_WORKSPACE_ROOT_PATH;
  if (
    (explicitRoot && path.resolve(explicitRoot) === path.resolve(dir)) ||
    isTrustedAncestorEntry(dir, name)
  ) {
    return true;
  }
  const entry = path.join(dir, name);
  warnUntrusted(
    entry,
    entry,
    `Set NX_WORKSPACE_ROOT_PATH=${dir} to use it anyway.`
  );
  return false;
}

/**
 * Whether the nx installed in `nodeModules` may be used for the workspace at
 * `root`. Each directory from `nodeModules` up to `root` is judged, or only
 * `nodeModules` when it sits above `root`. `NX_WORKSPACE_ROOT_PATH` vouches
 * for everything inside it.
 */
export function isTrustedNxInstall(nodeModules: string, root: string): boolean {
  const explicitRoot = process.env.NX_WORKSPACE_ROOT_PATH;
  const top = path.resolve(root);
  let entry = path.resolve(nodeModules);
  do {
    const dir = path.dirname(entry);
    if (
      !(explicitRoot && isInside(dir, path.resolve(explicitRoot))) &&
      !isTrustedAncestorEntry(dir, path.basename(entry))
    ) {
      warnUntrusted(
        `the nx installed in ${nodeModules}`,
        entry,
        'Install nx in the workspace to use it.'
      );
      return false;
    }
    entry = dir;
  } while (!isInside(top, entry));
  return true;
}

function isInside(p: string, dir: string): boolean {
  return (
    p === dir || p.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep)
  );
}

function warnUntrusted(subject: string, entry: string, remedy: string): void {
  if (warnedUntrusted.has(subject)) {
    return;
  }
  warnedUntrusted.add(subject);
  const where = subject === entry ? 'it is' : `${entry} is`;
  console.warn(
    `NX Ignoring ${subject} because ${where} in a world-writable directory and may have been placed there by another user. ${remedy}`
  );
}
