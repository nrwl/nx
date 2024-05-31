import { relative, resolve } from 'path/posix';
import { workspaceRoot, type Tree, joinPathFragments } from '@nx/devkit';

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

export function getViteConfigPath(tree: Tree, root: string) {
  return [
    joinPathFragments(root, `vite.config.ts`),
    joinPathFragments(root, `vite.config.cts`),
    joinPathFragments(root, `vite.config.mts`),
    joinPathFragments(root, `vite.config.js`),
    joinPathFragments(root, `vite.config.cjs`),
    joinPathFragments(root, `vite.config.mjs`),
  ].find((f) => tree.exists(f));
}
