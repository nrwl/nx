import {
  addDependenciesToPackageJson,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import {
  nxVersion,
  nuxtDevtoolsVersion,
  nuxtVersion,
  h3Version,
  nuxtUiTemplatesVersion,
} from '../../utils/versions';
import {
  lessVersion,
  sassVersion,
  vueRouterVersion,
  vueVersion,
  vueTscVersion,
} from '@nx/vue';
import { InitSchema } from './schema';

function updateDependencies(host: Tree, schema: InitSchema) {
  let devDependencies: { [key: string]: string } = {
    '@nx/nuxt': nxVersion,
    '@nx/vite': nxVersion, // needed for the nxViteTsPaths plugin
    '@nuxt/devtools': nuxtDevtoolsVersion,
    '@nuxt/ui-templates': nuxtUiTemplatesVersion,
    nuxt: nuxtVersion,
    h3: h3Version,
    vue: vueVersion,
    'vue-router': vueRouterVersion,
    'vue-tsc': vueTscVersion,
  };

  if (schema.style === 'scss') {
    devDependencies['sass'] = sassVersion;
  } else if (schema.style === 'less') {
    devDependencies['less'] = lessVersion;
  }

  return addDependenciesToPackageJson(host, {}, devDependencies);
}

export async function nuxtInitGenerator(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await jsInitGenerator(host, {
      ...schema,
      tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
      skipFormat: true,
    })
  );

  if (!schema.skipPackageJson) {
    const installTask = updateDependencies(host, schema);
    tasks.push(installTask);
  }

  return runTasksInSerial(...tasks);
}

export default nuxtInitGenerator;
