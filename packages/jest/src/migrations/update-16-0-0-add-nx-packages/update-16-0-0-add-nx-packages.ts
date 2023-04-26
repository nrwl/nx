import { Tree, formatFiles } from '@nx/devkit';
import { replaceNrwlPackageWithNxPackage } from '@nx/devkit/src/utils/replace-package';

export default async function replacePackage(tree: Tree): Promise<void> {
  await replaceNrwlPackageWithNxPackage(tree, '@nrwl/jest', '@nx/jest');

  await formatFiles(tree);
}
