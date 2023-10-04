import { workspaceRootInner } from './workspace-root';

/**
 * Recursive function that walks back up the directory
 * tree to try and find a workspace file.
 *
 * @param dir Directory to start searching with
 */
export function findWorkspaceRoot(dir: string): WorkspaceTypeAndRoot | null {
  const r = workspaceRootInner(dir, null);

  if (r === null) return null;

  if (isAngularCliInstalled(r)) {
    return { type: 'angular', dir: r };
  } else {
    return { type: 'nx', dir: r };
  }
}

export interface WorkspaceTypeAndRoot {
  type: 'nx' | 'angular';
  dir: string;
}

function isAngularCliInstalled(root: string): boolean {
  try {
    require.resolve('@angular/cli', {
      paths: [root],
    });
    return true;
  } catch {
    return false;
  }
}
