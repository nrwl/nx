import {
  addDependenciesToPackageJson,
  PluginConfiguration,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import {
  nxVersion,
  nuxtDevtoolsVersion,
  nuxtVersion,
  h3Version,
  nuxtUiTemplatesVersion,
} from '../../../utils/versions';
import {
  lessVersion,
  sassVersion,
  vueRouterVersion,
  vueVersion,
  vueTscVersion,
} from '@nx/vue';
import { InitSchema } from '../schema';

export function updateDependencies(host: Tree, schema: InitSchema) {
  let devDependencies: { [key: string]: string } = {
    '@nx/nuxt': nxVersion,
    '@nx/vite': nxVersion, // needed for the nxViteTsPaths plugin
    '@nuxt/devtools': nuxtDevtoolsVersion,
    '@nuxt/kit': nuxtVersion,
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

export function addVitestTargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    productionFileSet.push(
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      '!{projectRoot}/tsconfig.spec.json'
    );

    nxJson.namedInputs.production = Array.from(new Set(productionFileSet));
  }

  updateNxJson(tree, nxJson);
}

export function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/nuxt/plugin'
        : plugin.plugin === '@nx/nuxt/plugin'
    ) {
      return;
    }
  }

  nxJson.plugins.push({
    plugin: '@nx/nuxt/plugin',
    options: {
      buildTargetName: 'build',
      testTargetName: 'test',
      serveTargetName: 'serve',
    },
  });
  updateNxJson(tree, nxJson);
}
