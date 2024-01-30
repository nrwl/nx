import { Tree, joinPathFragments } from '@nx/devkit';

export function findViteConfig(tree: Tree, searchRoot: string) {
  const allowsExt = ['js', 'mjs', 'ts', 'cjs', 'mts', 'cts'];

  for (const ext of allowsExt) {
    if (tree.exists(joinPathFragments(searchRoot, `vite.config.${ext}`))) {
      return joinPathFragments(searchRoot, `vite.config.${ext}`);
    }
  }
}
