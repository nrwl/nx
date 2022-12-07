import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  readJson,
  readWorkspaceConfiguration,
  Tree,
  updateJson,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

import {
  jsdomVersion,
  nxVersion,
  vitePluginDtsVersion,
  vitePluginEslintVersion,
  vitePluginReactVersion,
  vitestUiVersion,
  vitestVersion,
  viteTsConfigPathsVersion,
  viteVersion,
} from '../../utils/versions';
import { Schema } from './schema';

function checkDependenciesInstalled(host: Tree, schema: Schema) {
  const packageJson = readJson(host, 'package.json');
  const devDependencies = {};
  const dependencies = {};
  packageJson.dependencies = packageJson.dependencies || {};
  packageJson.devDependencies = packageJson.devDependencies || {};

  // base deps
  devDependencies['@nrwl/vite'] = nxVersion;
  devDependencies['vite'] = viteVersion;
  devDependencies['vite-plugin-eslint'] = vitePluginEslintVersion;
  devDependencies['vite-tsconfig-paths'] = viteTsConfigPathsVersion;
  devDependencies['vitest'] = vitestVersion;
  devDependencies['@vitest/ui'] = vitestUiVersion;
  devDependencies['jsdom'] = jsdomVersion;

  if (schema.uiFramework === 'react') {
    devDependencies['@vitejs/plugin-react'] = vitePluginReactVersion;
  }

  if (schema.includeLib) {
    devDependencies['vite-plugin-dts'] = vitePluginDtsVersion;
  }

  return addDependenciesToPackageJson(host, dependencies, devDependencies);
}

function moveToDevDependencies(tree: Tree) {
  updateJson(tree, 'package.json', (packageJson) => {
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.devDependencies = packageJson.devDependencies || {};

    if (packageJson.dependencies['@nrwl/vite']) {
      packageJson.devDependencies['@nrwl/vite'] =
        packageJson.dependencies['@nrwl/vite'];
      delete packageJson.dependencies['@nrwl/vite'];
    }
    return packageJson;
  });
}

export function createVitestConfig(tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  const productionFileSet = workspaceConfiguration.namedInputs?.production;
  if (productionFileSet) {
    productionFileSet.push(
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      '!{projectRoot}/tsconfig.spec.json'
    );

    workspaceConfiguration.namedInputs.production = Array.from(
      new Set(productionFileSet)
    );
  }

  workspaceConfiguration.targetDefaults ??= {};
  workspaceConfiguration.targetDefaults.test ??= {};
  workspaceConfiguration.targetDefaults.test.inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];

  updateWorkspaceConfiguration(tree, workspaceConfiguration);
}

export function initGenerator(tree: Tree, schema: Schema) {
  moveToDevDependencies(tree);
  createVitestConfig(tree);
  const installTask = checkDependenciesInstalled(tree, schema);
  return installTask;
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
