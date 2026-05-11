import * as path from 'path';
import { fileExists } from './fileutils';

/**
 * The root of the workspace
 */
export let workspaceRoot = workspaceRootInner(process.cwd(), process.cwd());

const workspaceRootListeners: Array<() => void> = [];

/**
 * Register a callback that fires whenever `workspaceRoot` is reassigned.
 * Lets downstream modules (cache-directory, nx-deps-cache, tmp-dir, …)
 * refresh paths derived from the root without each consumer having to
 * call a function. In production this only fires at startup or never;
 * tests use it to swap the workspace root cleanly without a fresh
 * module graph.
 */
export function onWorkspaceRootChanged(listener: () => void): void {
  workspaceRootListeners.push(listener);
}

// Required for integration tests in projects which depend on Nx at runtime, such as lerna and angular-eslint
export function setWorkspaceRoot(root: string): void {
  workspaceRoot = root;
  for (const listener of workspaceRootListeners) listener();
}

export function workspaceRootInner(
  dir: string,
  candidateRoot: string | null
): string {
  if (process.env.NX_WORKSPACE_ROOT_PATH)
    return process.env.NX_WORKSPACE_ROOT_PATH;
  if (path.dirname(dir) === dir) return candidateRoot;

  const matches = [
    path.join(dir, 'nx.json'),
    path.join(dir, 'nx'),
    path.join(dir, 'nx.bat'),
  ];

  if (matches.some((x) => fileExists(x))) {
    return dir;

    // This handles the case where we have a workspace which uses npm / yarn / pnpm
    // workspaces, and has a project which contains Nx in its dependency tree.
    // e.g. packages/my-lib/package.json contains @nx/devkit, which references Nx and is
    // thus located in //packages/my-lib/node_modules/nx/package.json
  } else if (fileExists(path.join(dir, 'node_modules', 'nx', 'package.json'))) {
    return workspaceRootInner(path.dirname(dir), dir);
  } else {
    return workspaceRootInner(path.dirname(dir), candidateRoot);
  }
}
