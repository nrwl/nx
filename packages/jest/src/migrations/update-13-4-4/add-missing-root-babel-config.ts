import {
  addDependenciesToPackageJson,
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { JestExecutorOptions } from '@nrwl/jest/src/executors/jest/schema';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { jestConfigObject } from '../../utils/config/functions';
import { nxVersion } from '../../utils/versions';

function checkIfProjectNeedsUpdate(tree: Tree): boolean {
  if (tree.exists('babel.config.json')) {
    // the project is already running on babel and good to go
    return false;
  }

  let shouldUpdate = false;
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (jestOptions, projectName) => {
      const projectConfig = readProjectConfiguration(tree, projectName);
      const jestConfigPath = joinPathFragments(
        projectConfig.root,
        'jest.config.js'
      );

      if (!tree.exists(jestConfigPath)) {
        return;
      }

      const config = jestConfigObject(tree, jestConfigPath);

      if (config.transform) {
        for (const transformer of Object.values(config.transform)) {
          if (
            (typeof transformer === 'string' && transformer === 'babel-jest') ||
            (Array.isArray(transformer) && transformer[0] === 'babel-jest')
          ) {
            shouldUpdate = true;
          }
        }
      }
    }
  );

  return shouldUpdate;
}

export default async function update(tree: Tree) {
  const shouldUpdateConfigs = checkIfProjectNeedsUpdate(tree);

  if (shouldUpdateConfigs) {
    addDependenciesToPackageJson(tree, {}, { '@nrwl/web': nxVersion });

    tree.write('babel.config.json', '{"babelrcRoots": ["*"]}');

    await formatFiles(tree);
  }
}
