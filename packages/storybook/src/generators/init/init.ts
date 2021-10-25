import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  readJson,
  readWorkspaceConfiguration,
  Tree,
  updateJson,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { isFramework } from '../../utils/utilities';
import {
  babelCoreVersion,
  babelLoaderVersion,
  babelPresetTypescriptVersion,
  nxVersion,
  storybookReactNativeVersion,
  storybookVersion,
  svgrVersion,
  urlLoaderVersion,
} from '../../utils/versions';
import { Schema } from './schema';

function checkDependenciesInstalled(host: Tree, schema: Schema) {
  const packageJson = readJson(host, 'package.json');
  const devDependencies = {};
  const dependencies = {};
  packageJson.dependencies = packageJson.dependencies || {};
  packageJson.devDependencices = packageJson.devDependencices || {};

  // base deps
  devDependencies['@nrwl/storybook'] = nxVersion;

  /**
   * If Storybook already exists, do NOT update it to the latest version.
   * Leave it alone.
   */

  if (
    !packageJson.dependencies['@storybook/addon-essentials'] &&
    !packageJson.devDependencies['@storybook/addon-essentials']
  ) {
    devDependencies['@storybook/addon-essentials'] = storybookVersion;
  }

  if (isFramework('angular', schema)) {
    if (
      !packageJson.dependencies['@storybook/angular'] &&
      !packageJson.devDependencies['@storybook/angular']
    ) {
      devDependencies['@storybook/angular'] = storybookVersion;
    }

    if (
      !packageJson.dependencies['@storybook/builder-webpack5'] &&
      !packageJson.devDependencies['@storybook/builder-webpack5']
    ) {
      devDependencies['@storybook/builder-webpack5'] = storybookVersion;
    }

    if (
      !packageJson.dependencies['@storybook/manager-webpack5'] &&
      !packageJson.devDependencies['@storybook/manager-webpack5']
    ) {
      devDependencies['@storybook/manager-webpack5'] = storybookVersion;
    }

    if (
      !packageJson.dependencies['@angular/forms'] &&
      !packageJson.devDependencies['@angular/forms']
    ) {
      devDependencies['@angular/forms'] = '*';
    }
  }

  if (isFramework('react', schema)) {
    devDependencies['@storybook/react'] = storybookVersion;
    devDependencies['@svgr/webpack'] = svgrVersion;
    devDependencies['url-loader'] = urlLoaderVersion;
    devDependencies['babel-loader'] = babelLoaderVersion;
    devDependencies['@babel/core'] = babelCoreVersion;
    devDependencies['@babel/preset-typescript'] = babelPresetTypescriptVersion;

    if (
      !packageJson.dependencies['@storybook/react'] &&
      !packageJson.devDependencies['@storybook/react']
    ) {
      devDependencies['@storybook/react'] = storybookVersion;
    }

    if (
      !packageJson.dependencies['@storybook/builder-webpack5'] &&
      !packageJson.devDependencies['@storybook/builder-webpack5']
    ) {
      devDependencies['@storybook/builder-webpack5'] = storybookVersion;
    }

    if (
      !packageJson.dependencies['@storybook/manager-webpack5'] &&
      !packageJson.devDependencies['@storybook/manager-webpack5']
    ) {
      devDependencies['@storybook/manager-webpack5'] = storybookVersion;
    }
  }

  if (isFramework('html', schema)) {
    devDependencies['@storybook/html'] = storybookVersion;
  }

  if (isFramework('vue', schema)) {
    devDependencies['@storybook/vue'] = storybookVersion;
  }

  if (isFramework('vue3', schema)) {
    devDependencies['@storybook/vue3'] = storybookVersion;
  }

  if (isFramework('web-components', schema)) {
    devDependencies['@storybook/web-components'] = storybookVersion;
  }

  if (isFramework('svelte', schema)) {
    devDependencies['@storybook/svelte'] = storybookVersion;
  }

  if (isFramework('react-native', schema)) {
    if (
      !packageJson.dependencies['@storybook/react-native'] &&
      !packageJson.devDependencies['@storybook/react-native']
    ) {
      devDependencies['@storybook/react-native'] = storybookReactNativeVersion;
    }

    if (
      !packageJson.dependencies['@storybook/react-native-server'] &&
      !packageJson.devDependencies['@storybook/react-native-server']
    ) {
      devDependencies['@storybook/react-native-server'] ==
        storybookReactNativeVersion;
    }
  }

  return addDependenciesToPackageJson(host, dependencies, devDependencies);
}

export function addCacheableOperation(tree: Tree) {
  const workspace = readWorkspaceConfiguration(tree);
  if (
    !workspace.tasksRunnerOptions ||
    !workspace.tasksRunnerOptions.default ||
    workspace.tasksRunnerOptions.default.runner !==
      '@nrwl/workspace/tasks-runners/default'
  ) {
    return;
  }

  workspace.tasksRunnerOptions.default.options =
    workspace.tasksRunnerOptions.default.options || {};

  workspace.tasksRunnerOptions.default.options.cacheableOperations =
    workspace.tasksRunnerOptions.default.options.cacheableOperations || [];
  if (
    !workspace.tasksRunnerOptions.default.options.cacheableOperations.includes(
      'build-storybook'
    )
  ) {
    workspace.tasksRunnerOptions.default.options.cacheableOperations.push(
      'build-storybook'
    );
  }
  updateWorkspaceConfiguration(tree, workspace);
}

function moveToDevDependencies(tree: Tree) {
  updateJson(tree, 'package.json', (packageJson) => {
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.devDependencies = packageJson.devDependencies || {};

    if (packageJson.dependencies['@nrwl/storybook']) {
      packageJson.devDependencies['@nrwl/storybook'] =
        packageJson.dependencies['@nrwl/storybook'];
      delete packageJson.dependencies['@nrwl/storybook'];
    }
    return packageJson;
  });
}

export function initGenerator(tree: Tree, schema: Schema) {
  const installTask = checkDependenciesInstalled(tree, schema);
  moveToDevDependencies(tree);
  addCacheableOperation(tree);
  return installTask;
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
