import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';

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
  const tasks: GeneratorCallback[] = [];

  tasks.push(removeDependenciesFromPackageJson(host, ['@nx/vue'], []));

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

  tasks.push(addDependenciesToPackageJson(host, dependencies, devDependencies));

  return runTasksInSerial(...tasks);
}

export async function vueInitGenerator(host: Tree, schema: InitSchema) {
  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = updateDependencies(host, schema);
  }

  if (!schema.skipFormat) {
    await formatFiles(host);
  }

  return installTask;
}

export default vueInitGenerator;
