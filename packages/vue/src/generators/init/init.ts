import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';

import { initGenerator as jsInitGenerator } from '@nx/js';
import {
  lessVersion,
  nxVersion,
  sassVersion,
  vitePluginVueVersion,
  vueRouterVersion,
  vueTestUtilsVersion,
  vueTsconfigVersion,
  vueTscVersion,
  vueVersion,
} from '../../utils/versions';
import { InitSchema } from './schema';

function updateDependencies(host: Tree, schema: InitSchema) {
  removeDependenciesFromPackageJson(host, ['@nx/vue'], []);

  let dependencies: { [key: string]: string } = {
    vue: vueVersion,
  };

  let devDependencies: { [key: string]: string } = {
    '@nx/vue': nxVersion,
    '@vue/tsconfig': vueTsconfigVersion,
    '@vue/test-utils': vueTestUtilsVersion,
    '@vitejs/plugin-vue': vitePluginVueVersion,
    'vue-tsc': vueTscVersion,
  };

  if (schema.routing) {
    dependencies['vue-router'] = vueRouterVersion;
  }

  if (schema.style === 'scss') {
    devDependencies['sass'] = sassVersion;
  } else if (schema.style === 'less') {
    devDependencies['less'] = lessVersion;
  }

  return addDependenciesToPackageJson(host, dependencies, devDependencies);
}

export async function vueInitGenerator(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await jsInitGenerator(host, {
      ...schema,
      tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
      skipFormat: true,
    })
  );

  tasks.push(updateDependencies(host, schema));

  return runTasksInSerial(...tasks);
}

export default vueInitGenerator;
