import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  readJson,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateJson,
  updateNxJson,
} from '@nrwl/devkit';

import { initGenerator as jsInitGenerator } from '@nrwl/js';

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
import { InitGeneratorSchema } from './schema';

function checkDependenciesInstalled(host: Tree, schema: InitGeneratorSchema) {
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
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    productionFileSet.push(
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      '!{projectRoot}/tsconfig.spec.json'
    );

    nxJson.namedInputs.production = Array.from(new Set(productionFileSet));
  }

  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults.test ??= {};
  nxJson.targetDefaults.test.inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];

  updateNxJson(tree, nxJson);
}

export async function initGenerator(tree: Tree, schema: InitGeneratorSchema) {
  moveToDevDependencies(tree);
  createVitestConfig(tree);
  const tasks = [];

  tasks.push(
    await jsInitGenerator(tree, {
      ...schema,
      skipFormat: true,
    })
  );

  tasks.push(checkDependenciesInstalled(tree, schema));
  return runTasksInSerial(...tasks);
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
