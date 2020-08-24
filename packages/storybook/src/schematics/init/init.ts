import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  readJsonInTree,
  updateJsonInTree,
} from '@nrwl/workspace';
import {
  babelLoaderVersion,
  babelCoreVersion,
  storybookVersion,
  nxVersion,
  babelPresetTypescriptVersion,
} from '../../utils/versions';
import { isFramework } from '../../utils/utils';
import { Schema } from './schema';

function checkDependenciesInstalled(schema: Schema): Rule {
  return (host: Tree, context: SchematicContext): Rule => {
    const packageJson = readJsonInTree(host, 'package.json');
    const devDependencies = {};
    const dependencies = {};

    // base deps
    devDependencies['@nrwl/storybook'] = nxVersion;
    devDependencies['@storybook/addon-knobs'] = storybookVersion;

    if (isFramework('angular', schema)) {
      devDependencies['@storybook/angular'] = storybookVersion;
      if (
        !packageJson.dependencies['@angular/forms'] &&
        !packageJson.devDependencies['@angular/forms']
      ) {
        devDependencies['@angular/forms'] = '*';
      }
    }
    if (isFramework('react', schema)) {
      devDependencies['@storybook/react'] = storybookVersion;
      devDependencies['babel-loader'] = babelLoaderVersion;
      devDependencies['@babel/core'] = babelCoreVersion;
      devDependencies[
        '@babel/preset-typescript'
      ] = babelPresetTypescriptVersion;
    }

    return addDepsToPackageJson(dependencies, devDependencies);
  };
}

export const addCacheableOperation = updateJsonInTree('nx.json', (nxJson) => {
  if (
    !nxJson.tasksRunnerOptions ||
    !nxJson.tasksRunnerOptions.default ||
    nxJson.tasksRunnerOptions.default.runner !==
      '@nrwl/workspace/tasks-runners/default'
  ) {
    return nxJson;
  }

  nxJson.tasksRunnerOptions.default.options =
    nxJson.tasksRunnerOptions.default.options || {};

  nxJson.tasksRunnerOptions.default.options.cacheableOperations =
    nxJson.tasksRunnerOptions.default.options.cacheableOperations || [];

  if (
    !nxJson.tasksRunnerOptions.default.options.cacheableOperations.includes(
      'build-storybook'
    )
  ) {
    nxJson.tasksRunnerOptions.default.options.cacheableOperations.push(
      'build-storybook'
    );
  }

  return nxJson;
});

const moveToDevDependencies = updateJsonInTree(
  'package.json',
  (packageJson) => {
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.devDependencies = packageJson.devDependencies || {};

    if (packageJson.dependencies['@nrwl/storybook']) {
      packageJson.devDependencies['@nrwl/storybook'] =
        packageJson.dependencies['@nrwl/storybook'];
      delete packageJson.dependencies['@nrwl/storybook'];
    }
    return packageJson;
  }
);

export default function (schema: Schema) {
  return chain([
    checkDependenciesInstalled(schema),
    moveToDevDependencies,
    addCacheableOperation,
  ]);
}
