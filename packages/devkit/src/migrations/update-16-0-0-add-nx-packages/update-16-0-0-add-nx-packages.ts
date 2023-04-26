import type { Tree } from 'nx/src/generators/tree';
import { formatFiles } from '../../generators/format-files';
import { replaceNrwlPackageWithNxPackage } from '../../utils/replace-package';

export default async function replacePackage(tree: Tree): Promise<void> {
  await replaceNrwlPackageWithNxPackage(tree, '@nrwl/devkit', '@nx/devkit');

  await formatFiles(tree);
}
