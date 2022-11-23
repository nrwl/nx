import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  readJson,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

import {
  nxVersion,
  vitePluginEslintVersion,
  vitePluginReactVersion,
  viteVersion,
  vitestUiVersion,
  vitestVersion,
  viteTsConfigPathsVersion,
  jsdomVersion,
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

export function initGenerator(tree: Tree, schema: Schema) {
  moveToDevDependencies(tree);
  const installTask = checkDependenciesInstalled(tree, schema);
  return installTask;
}

export default initGenerator;
export const initSchematic = convertNxGenerator(initGenerator);
