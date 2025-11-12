import { join } from 'path';
import { workspaceRoot } from './workspace-root.js';

export function getNxInstallationPath(root: string = workspaceRoot) {
  return join(root, '.nx', 'installation');
}

export function getNxRequirePaths(root: string = workspaceRoot) {
  return [root, getNxInstallationPath(root)];
}
