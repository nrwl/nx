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
    isTrustedWorkspaceEntry(dir, 'node_modules')
  ) {
    return workspaceRootInner(path.dirname(dir), dir);
  } else {
    return workspaceRootInner(path.dirname(dir), candidateRoot);
  }
}

/**
 * Whether a workspace marker or nx install found by walking up from the cwd
 * may be used. `NX_WORKSPACE_ROOT_PATH` vouches for its own entries.
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
  if (!warnedUntrusted.has(entry)) {
    warnedUntrusted.add(entry);
    console.warn(
      `NX Ignoring ${entry} because another user owns it in a world-writable directory. ` +
        `Set NX_WORKSPACE_ROOT_PATH=${dir} to use it anyway.`
    );
  }
  return false;
}
