import { Tree, formatFiles, updateJson } from '@nx/devkit';
import type { PackageJson } from 'nx/src/utils/package-json';

export default async function update(tree: Tree) {
  if (tree.exists('./package.json')) {
    updateJson<PackageJson>(tree, 'package.json', (packageJson) => {
      if (packageJson.dependencies['@nx/next']) {
        packageJson.devDependencies['@nx/next'] =
          packageJson.dependencies['@nx/next'];
        delete packageJson.dependencies['@nx/next'];
      }
      return packageJson;
    });
  }
  await formatFiles(tree);
}
