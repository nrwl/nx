import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';

import { initGenerator as jsInitGenerator } from '@nx/js';
import {
  nxVersion,
  vueVersion,
  vueTsconfigVersion,
  vueTscVersion,
  vueRouterVersion,
  vitePluginVueVersion,
  vueTestUtilsVersion,
} from '../../utils/versions';
import { InitSchema } from './schema';

function setDefault(host: Tree) {
  const workspace = readNxJson(host);

  workspace.generators = workspace.generators || {};
  const vueGenerators = workspace.generators['@nx/vue'] || {};
  const generators = {
    ...workspace.generators,
    '@nx/vue': {
      ...vueGenerators,
      application: {
        ...vueGenerators.application,
        babel: true,
      },
    },
  };

  updateNxJson(host, { ...workspace, generators });
}

function updateDependencies(host: Tree, schema: InitSchema) {
  removeDependenciesFromPackageJson(host, ['@nx/vue'], []);

  let dependencies: { [key: string]: string } = {
    vue: vueVersion,
    'vue-tsc': vueTscVersion,
  };

  let devDependencies: { [key: string]: string } = {
    '@nx/vue': nxVersion,
    '@vue/tsconfig': vueTsconfigVersion,
    '@vue/test-utils': vueTestUtilsVersion,
  };

  if (schema.unitTestRunner === 'vitest') {
    devDependencies['@vitejs/plugin-vue'] = vitePluginVueVersion;
  }

  if (schema.routing) {
    dependencies = {
      ...dependencies,
      'vue-router': vueRouterVersion,
    };
  }

  return addDependenciesToPackageJson(host, dependencies, devDependencies);
}

export async function vueInitGenerator(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  const jsInitTask = await jsInitGenerator(host, {
    ...schema,
    tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    skipFormat: true,
  });

  tasks.push(jsInitTask);

  setDefault(host);

  const installTask = updateDependencies(host, schema);
  tasks.push(installTask);

  return runTasksInSerial(...tasks);
}

export default vueInitGenerator;

export const vueInitSchematic = convertNxGenerator(vueInitGenerator);
