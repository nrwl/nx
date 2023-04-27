import { Tree, formatFiles, visitNotIgnoredFiles } from '@nx/devkit';
import { replaceNrwlPackageWithNxPackage } from '@nx/devkit/src/utils/replace-package';

import { basename } from 'path';
import { isBinaryPath } from '@nx/devkit/src/utils/binary-extensions';

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

  /**
   * Matches:
   * * // eslint-disable-next-line @nrwl/nx/...
   * * // eslint-disable-line @nrwl/nx/...
   * * /* eslint-disable @nrwl/nx/...
   */
  const ignoreLineRegex = /(eslint-disable(?:(?:-next)?-line)?\s*)@nrwl\/nx/g;
  visitNotIgnoredFiles(tree, '.', (path) => {
    if (isBinaryPath(path)) {
      return;
    }

    let contents = tree.read(path).toString();
    if (eslintFileNames.includes(basename(path))) {
      if (!contents.includes('@nrwl/nx')) {
        return;
      }

      contents = contents.replace(new RegExp('@nrwl/nx', 'g'), '@nx');
    }
    if (ignoreLineRegex.test(contents)) {
      contents = contents.replace(ignoreLineRegex, '$1@nx');
    }
    tree.write(path, contents);
  });

  await formatFiles(tree);
}
