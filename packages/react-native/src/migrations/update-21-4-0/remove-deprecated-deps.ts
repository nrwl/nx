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
      ['@testing-library/jest-native', 'jest-react-native'],
      ['@testing-library/jest-native', 'jest-react-native']
    );
    updateJson(tree, appPackageJsonPath, (packageJson) => {
      if (packageJson.dependencies?.['@testing-library/jest-native']) {
        delete packageJson.dependencies['@testing-library/jest-native'];
      }
      if (packageJson.dependencies?.['jest-react-native']) {
        delete packageJson.dependencies['jest-react-native'];
      }
      return packageJson;
    });
  }
}
