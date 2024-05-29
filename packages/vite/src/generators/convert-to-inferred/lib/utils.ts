import { relative, resolve } from 'path/posix';
import { workspaceRoot } from '@nx/devkit';

export function toProjectRelativePath(
  path: string,
  projectRoot: string
): string {
  if (projectRoot === '.') {
    // workspace and project root are the same, we normalize it to ensure it
    // works with Jest since some paths only work when they start with `./`
    return path.startsWith('.') ? path : `./${path}`;
  }

  const relativePath = relative(
    resolve(workspaceRoot, projectRoot),
    resolve(workspaceRoot, path)
  );

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}
