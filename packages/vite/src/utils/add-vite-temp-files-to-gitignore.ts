import { stripIndents, Tree } from '@nx/devkit';

export function addViteTempFilesToGitIgnore(tree: Tree) {
  let newGitIgnoreContents = `vite.config.*.timestamp*`;
  if (tree.exists('.gitignore')) {
    const gitIgnoreContents = tree.read('.gitignore', 'utf-8');
    if (!gitIgnoreContents.includes(newGitIgnoreContents)) {
      newGitIgnoreContents = stripIndents`${gitIgnoreContents}
        ${newGitIgnoreContents}`;

      tree.write('.gitignore', newGitIgnoreContents);
    }
  } else {
    tree.write('.gitignore', newGitIgnoreContents);
  }
}
