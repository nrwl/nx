import { Tree } from '@nx/devkit';

export function updateGitIgnore(tree: Tree) {
  const contents = tree.read('.gitignore', 'utf-8') ?? '';
  tree.write(
    '.gitignore',
    [
      contents,
      '# Nuxt dev/build outputs',
      '.output',
      '.data',
      '.nuxt',
      '.nitro',
      '.cache',
    ].join('\n')
  );
}
