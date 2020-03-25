import {
  chain,
  Rule,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import {
  babelLoaderVersion,
  babelCoreVersion,
  storybookVersion
} from '../../utils/versions';
import { Schema } from './schema';

function checkDependenciesInstalled(): Rule {
  return (host: Tree, context: SchematicContext): Rule => {
    const packageJson = readJsonInTree(host, 'package.json');
    const devDependencies = { ...packageJson.devDependencies };
    const dependencies = { ...packageJson.dependencies };
    if (!packageJson.devDependencies['@storybook/angular']) {
      devDependencies['@nrwl/storybook'] = '*';
      devDependencies['@storybook/angular'] = storybookVersion;
      devDependencies['@storybook/react'] = storybookVersion;
      devDependencies['@storybook/addon-knobs'] = storybookVersion;
      devDependencies['babel-loader'] = babelLoaderVersion;
      devDependencies['@babel/core'] = babelCoreVersion;
    }
    if (
      !packageJson.dependencies['@angular/forms'] &&
      !packageJson.devDependencies['@angular/forms']
    ) {
      devDependencies['@angular/forms'] = '*';
    }
    if (packageJson.dependencies['@nrwl/storybook']) {
      delete dependencies['@nrwl/storybook'];
    }

    return updateJsonInTree('package.json', json => {
      json.dependencies = dependencies;
      json.devDependencies = devDependencies;
      return json;
    });
  };
}

export const addCacheableOperation = updateJsonInTree('nx.json', nxJson => {
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

export default function(schema: Schema) {
  return chain([checkDependenciesInstalled(), addCacheableOperation]);
}
