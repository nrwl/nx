import type { Tree } from '@nx/devkit';

export function addViteTempFilesToGitIgnore(tree: Tree) {
  let gitIgnoreContents = `**/vite.config.{js,ts,mjs,mts,cjs,cts}.timestamp*`;
  if (tree.exists('.gitignore')) {
    gitIgnoreContents = `${tree.read('.gitignore', 'utf-8')}
    ${gitIgnoreContents}`;
  }

  tree.write('.gitignore', gitIgnoreContents);
}
