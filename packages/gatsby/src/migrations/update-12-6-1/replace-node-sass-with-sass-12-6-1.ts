import {
  addDependenciesToPackageJson,
  Tree,
  formatFiles,
  removeDependenciesFromPackageJson,
  readJson,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { sassVersion } from '../../utils/versions';

/**
 * For gatsby app with style scss option, replace node-sass with sass in package.json
 */
export default async function update(tree: Tree) {
  const packageJson = readJson(tree, 'package.json');

  // does not proceed if gatsby-plugin-sass is not a part of devDependencies
  if (!packageJson.devDependencies['gatsby-plugin-sass']) {
    return;
  }

  const uninstallTask = removeDependenciesFromPackageJson(
    tree,
    [],
    ['node-sass']
  );
  const installTask = addDependenciesToPackageJson(
    tree,
    {},
    {
      sass: sassVersion,
    }
  );
  await formatFiles(tree);

  return runTasksInSerial(uninstallTask, installTask);
}
