import {
  Tree,
  getProjects,
  logger,
  offsetFromRoot,
  updateJson,
} from '@nx/devkit';
import { join } from 'path';

/**
 * Remove eas-build-pre-install script from app's package.json.
 * This script causes an issue with Yarn 4.
 */
export default function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/expo:start') {
      try {
        updateJson(tree, join(config.root, 'package.json'), (packageJson) => {
          if (packageJson.scripts?.['eas-build-pre-install']) {
            delete packageJson.scripts['eas-build-pre-install'];
          }
          return packageJson;
        });
      } catch {
        logger.error(`Unable to update package.json for project ${name}.`);
      }
    }
  }
}
