import {
  Tree,
  getProjects,
  updateJson,
  removeDependenciesFromPackageJson,
} from '@nx/devkit';
import { join } from 'path';

/**
 * Remove deprecated dependencies from the root and app package.json.
 */
export default function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [_, config] of projects.entries()) {
    const appPackageJsonPath = join(config.root, 'package.json');

    if (!tree.exists(appPackageJsonPath)) {
      continue;
    }

    removeDependenciesFromPackageJson(
      tree,
      ['@testing-library/jest-native', 'react-test-renderer'],
      ['@testing-library/jest-native', 'react-test-renderer']
    );
    updateJson(tree, appPackageJsonPath, (packageJson) => {
      if (packageJson.dependencies?.['@testing-library/jest-native']) {
        delete packageJson.dependencies['@testing-library/jest-native'];
      }
      if (packageJson.dependencies?.['jest-react-native']) {
        delete packageJson.dependencies['jest-react-native'];
      }
      if (packageJson.dependencies?.['react-test-renderer']) {
        delete packageJson.dependencies['react-test-renderer'];
      }
      return packageJson;
    });
  }
}
