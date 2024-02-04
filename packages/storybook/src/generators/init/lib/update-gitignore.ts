import { Tree } from '@nx/devkit';

export function updateGitignore(tree: Tree) {
  if (!tree.exists('.gitignore')) {
    return;
  }
  const gitignore = tree.read('.gitignore', 'utf-8');

  const regex = /storybook-static/gm;
  const hasStorybookStatic = regex.test(gitignore ?? '');
  if (hasStorybookStatic) {
    return;
  }
  tree.write('.gitignore', `${gitignore}\n\nstorybook-static`);
}
