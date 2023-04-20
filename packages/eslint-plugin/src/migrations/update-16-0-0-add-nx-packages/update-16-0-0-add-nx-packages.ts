import { Tree, formatFiles, visitNotIgnoredFiles } from '@nx/devkit';
import { replaceNrwlPackageWithNxPackage } from '@nx/devkit/src/utils/replace-package';

import { basename } from 'path';

const eslintFileNames = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.json',
  'eslint.config.js', // new format that requires `ESLINT_USE_FLAT_CONFIG=true`
];

export default async function replacePackage(tree: Tree): Promise<void> {
  await replaceNrwlPackageWithNxPackage(
    tree,
    '@nrwl/eslint-plugin-nx',
    '@nx/eslint-plugin'
  );

  visitNotIgnoredFiles(tree, '.', (path) => {
    if (!eslintFileNames.includes(basename(path))) {
      return;
    }

    const contents = tree.read(path).toString();

    if (!contents.includes('@nrwl/nx')) {
      return;
    }

    tree.write(path, contents.replace(new RegExp('@nrwl/nx', 'g'), '@nx'));
  });

  await formatFiles(tree);
}
