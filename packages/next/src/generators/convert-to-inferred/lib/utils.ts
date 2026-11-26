import type { Tree } from '@nx/devkit';

export function findNextConfigPath(
  tree: Tree,
  projectRoot: string
): string | undefined {
  const validExtensions = ['js', 'cjs'];

  for (const extension of validExtensions) {
    const path = `${projectRoot}/next.config.${extension}`;
    if (tree.exists(path)) {
      return path;
    }
  }
}
