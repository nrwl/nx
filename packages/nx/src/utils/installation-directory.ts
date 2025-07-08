import { join } from 'path';
import { workspaceRoot } from './workspace-root';

export function getNxInstallationPath(root: string = workspaceRoot) {
  return join(root, '.nx', 'installation');
}

export function getNxRequirePaths(root: string = workspaceRoot) {
  const paths = [root, getNxInstallationPath(root)];
  console.log(`[getNxRequirePaths] Workspace root: ${root}`);
  console.log(
    `[getNxRequirePaths] Installation path: ${getNxInstallationPath(root)}`
  );
  console.log(`[getNxRequirePaths] Final paths: ${paths.join(', ')}`);
  return paths;
}
