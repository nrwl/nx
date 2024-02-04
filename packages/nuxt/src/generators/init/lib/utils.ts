import {
  addDependenciesToPackageJson,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { nuxtVersion, nxVersion } from '../../../utils/versions';
import { InitSchema } from '../schema';

export function updateDependencies(host: Tree, schema: InitSchema) {
  return addDependenciesToPackageJson(
    host,
    {},
    {
      '@nx/nuxt': nxVersion,
      nuxt: nuxtVersion,
    },
    undefined,
    schema.keepExistingVersions
  );
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

  let hasNxNuxtPlugin = false;
  let hasNxVitePlugin = false;

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/nuxt/plugin'
        : plugin.plugin === '@nx/nuxt/plugin'
    ) {
      hasNxNuxtPlugin = true;
    }
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/vite/plugin'
        : plugin.plugin === '@nx/vite/plugin'
    ) {
      hasNxVitePlugin = true;
    }
  }

  if (!hasNxNuxtPlugin) {
    nxJson.plugins.push({
      plugin: '@nx/nuxt/plugin',
      options: {
        buildTargetName: 'build',
        serveTargetName: 'serve',
      },
    });
  }

  if (!hasNxVitePlugin) {
    nxJson.plugins.push({
      plugin: '@nx/vite/plugin',
      options: {
        buildTargetName: 'build',
        previewTargetName: 'preview',
        testTargetName: 'test',
        serveTargetName: 'serve',
        serveStaticTargetName: 'serve-static',
      },
    });
  }

  updateNxJson(tree, nxJson);
}
