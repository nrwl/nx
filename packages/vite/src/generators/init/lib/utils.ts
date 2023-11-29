import {
  addDependenciesToPackageJson,
  logger,
  readJson,
  readNxJson,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';

import {
  edgeRuntimeVmVersion,
  happyDomVersion,
  jsdomVersion,
  nxVersion,
  vitePluginDtsVersion,
  vitePluginReactSwcVersion,
  vitePluginReactVersion,
  vitestVersion,
  viteVersion,
} from '../../../utils/versions';
import { InitGeneratorSchema } from '../schema';

export function checkDependenciesInstalled(
  host: Tree,
  schema: InitGeneratorSchema
) {
  const packageJson = readJson(host, 'package.json');
  const devDependencies = {};
  const dependencies = {};
  packageJson.dependencies = packageJson.dependencies || {};
  packageJson.devDependencies = packageJson.devDependencies || {};

  // base deps
  devDependencies['@nx/vite'] = nxVersion;
  devDependencies['vite'] = viteVersion;
  devDependencies['vitest'] = vitestVersion;
  devDependencies['@vitest/ui'] = vitestVersion;

  if (schema.testEnvironment === 'jsdom') {
    devDependencies['jsdom'] = jsdomVersion;
  } else if (schema.testEnvironment === 'happy-dom') {
    devDependencies['happy-dom'] = happyDomVersion;
  } else if (schema.testEnvironment === 'edge-runtime') {
    devDependencies['@edge-runtime/vm'] = edgeRuntimeVmVersion;
  } else if (schema.testEnvironment !== 'node' && schema.testEnvironment) {
    logger.info(
      `A custom environment was provided: ${schema.testEnvironment}. You need to install it manually.`
    );
  }

  if (schema.uiFramework === 'react') {
    if (schema.compiler === 'swc') {
      devDependencies['@vitejs/plugin-react-swc'] = vitePluginReactSwcVersion;
    } else {
      devDependencies['@vitejs/plugin-react'] = vitePluginReactVersion;
    }
  }

  if (schema.includeLib) {
    devDependencies['vite-plugin-dts'] = vitePluginDtsVersion;
  }

  return addDependenciesToPackageJson(host, dependencies, devDependencies);
}

export function moveToDevDependencies(tree: Tree) {
  updateJson(tree, 'package.json', (packageJson) => {
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.devDependencies = packageJson.devDependencies || {};

    if (packageJson.dependencies['@nx/vite']) {
      packageJson.devDependencies['@nx/vite'] =
        packageJson.dependencies['@nx/vite'];
      delete packageJson.dependencies['@nx/vite'];
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
  nxJson.targetDefaults['@nx/vite:test'] ??= {};
  nxJson.targetDefaults['@nx/vite:test'].cache ??= true;
  nxJson.targetDefaults['@nx/vite:test'].inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];
  nxJson.targetDefaults['@nx/vite:test'].options ??= {
    passWithNoTests: true,
  };

  updateNxJson(tree, nxJson);
}

export function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/vite/plugin'
        : plugin.plugin === '@nx/vite/plugin'
    ) {
      return;
    }
  }

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
  updateNxJson(tree, nxJson);
}
