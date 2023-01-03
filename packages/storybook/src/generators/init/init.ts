import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  readJson,
  readNxJson,
  Tree,
  updateJson,
  updateNxJson,
} from '@nrwl/devkit';
import { isFramework } from '../../utils/utilities';

import {
  babelCoreVersion,
  babelLoaderVersion,
  babelPresetTypescriptVersion,
  htmlWebpackPluginVersion,
  litHtmlVersion,
  nxVersion,
  reactNativeStorybookLoader,
  storybookReactNativeVersion,
  storybookVersion,
  svgrVersion,
  urlLoaderVersion,
  viteBuilderVersion,
  webpack5Version,
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
  devDependencies['@storybook/core-server'] = storybookVersion;
  devDependencies['@storybook/addon-essentials'] = storybookVersion;

  if (schema.bundler === 'vite') {
    devDependencies['@storybook/builder-vite'] = viteBuilderVersion;
  } else {
    devDependencies['@storybook/builder-webpack5'] = storybookVersion;
    devDependencies['@storybook/manager-webpack5'] = storybookVersion;
  }

  // TODO(katerina): Remove this when Storybook 7.0 is added in Nx
  devDependencies['html-webpack-plugin'] = htmlWebpackPluginVersion;

  if (isFramework('angular', schema)) {
    devDependencies['@storybook/angular'] = storybookVersion;
    devDependencies['webpack'] = webpack5Version;

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
    devDependencies['@storybook/react'] = storybookVersion;
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
    devDependencies['lit-html'] = litHtmlVersion;
  }

  if (isFramework('svelte', schema)) {
    devDependencies['@storybook/svelte'] = storybookVersion;
  }

  if (isFramework('react-native', schema)) {
    devDependencies['@storybook/react-native'] = storybookReactNativeVersion;
    devDependencies['@storybook/addon-ondevice-actions'] =
      storybookReactNativeVersion;
    devDependencies['@storybook/addon-ondevice-backgrounds'] =
      storybookReactNativeVersion;
    devDependencies['@storybook/addon-ondevice-controls'] =
      storybookReactNativeVersion;
    devDependencies['@storybook/addon-ondevice-notes'] =
      storybookReactNativeVersion;
    devDependencies['react-native-storybook-loader'] =
      reactNativeStorybookLoader;
  }

  return addDependenciesToPackageJson(host, dependencies, devDependencies);
}

function addCacheableOperation(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (
    !nxJson.tasksRunnerOptions ||
    !nxJson.tasksRunnerOptions.default ||
    (nxJson.tasksRunnerOptions.default.runner !==
      '@nrwl/workspace/tasks-runners/default' &&
      nxJson.tasksRunnerOptions.default.runner !== 'nx/tasks-runners/default')
  ) {
    return;
  }

  nxJson.tasksRunnerOptions.default.options =
    nxJson.tasksRunnerOptions.default.options || {};

  nxJson.tasksRunnerOptions.default.options.cacheableOperations =
    nxJson.tasksRunnerOptions.default.options.cacheableOperations || [];
  if (
    !nxJson.tasksRunnerOptions.default.options.cacheableOperations?.includes(
      'build-storybook'
    )
  ) {
    nxJson.tasksRunnerOptions.default.options.cacheableOperations.push(
      'build-storybook'
    );
  }
  updateNxJson(tree, nxJson);
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

/**
 * This is a temporary fix for Storybook to support TypeScript configuration files.
 * The issue is that if there is a root tsconfig.json file, Storybook will use it, and
 * ignore the tsconfig.json file in the .storybook folder. This results in module being set
 * to esnext, and Storybook does not recognise the main.ts code as a module.
 */
function editRootTsConfig(tree: Tree) {
  if (tree.exists('tsconfig.json')) {
    updateJson(tree, 'tsconfig.json', (json) => {
      if (json['ts-node']) {
        json['ts-node'] = {
          ...json['ts-node'],
          compilerOptions: {
            ...(json['ts-node'].compilerOptions ?? {}),
            module: 'commonjs',
          },
        };
      } else {
        json['ts-node'] = {
          compilerOptions: {
            module: 'commonjs',
          },
        };
      }
      return json;
    });
  }
}

export function initGenerator(tree: Tree, schema: Schema) {
  const installTask = checkDependenciesInstalled(tree, schema);
  moveToDevDependencies(tree);
  editRootTsConfig(tree);
  addCacheableOperation(tree);
  return installTask;
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
