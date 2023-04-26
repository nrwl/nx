import { Tree, formatFiles } from '@nx/devkit';
import { replaceNrwlPackageWithNxPackage } from '@nx/devkit/src/utils/replace-package';

export default async function replacePackage(tree: Tree): Promise<void> {
  replaceNrwlPackageWithNxPackage(tree, '@nrwl/detox', '@nx/detox');

  await formatFiles(tree);
}
