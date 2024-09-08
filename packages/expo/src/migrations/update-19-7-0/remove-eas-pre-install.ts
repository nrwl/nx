import { Tree, getProjects, logger, updateJson } from '@nx/devkit';
import { join } from 'path';

/**
 * Remove eas-build-pre-install script from app's package.json.
 * This script causes an issue with Yarn 4.
 */
export default function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [_, config] of projects.entries()) {
    const packageJsonPath = join(config.root, 'package.json');
    if (!tree.exists(packageJsonPath)) {
      continue;
    }
    updateJson(tree, join(config.root, 'package.json'), (packageJson) => {
      if (packageJson.scripts?.['eas-build-pre-install']) {
        delete packageJson.scripts['eas-build-pre-install'];
      }
      return packageJson;
    });
  }
}
