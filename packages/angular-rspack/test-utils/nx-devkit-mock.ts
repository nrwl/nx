import * as path from 'path';
import { PathLike, statSync } from 'node:fs';

export const logger = {
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
  info: (...args: unknown[]) => console.info(...args),
  log: (...args: unknown[]) => console.log(...args),
  debug: (...args: unknown[]) => console.debug(...args),
  fatal: (...args: unknown[]) => console.error(...args),
  verbose: (...args: unknown[]) => console.log(...args),
};

export function fileExists(path: PathLike): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

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
