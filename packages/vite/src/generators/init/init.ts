import {
  addDependenciesToPackageJson,
  logger,
  readJson,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';

import { initGenerator as jsInitGenerator } from '@nx/js';

import {
  edgeRuntimeVmVersion,
  happyDomVersion,
  jsdomVersion,
  nxVersion,
  vitePluginDtsVersion,
  vitePluginReactSwcVersion,
  vitePluginReactVersion,
  vitestUiVersion,
  vitestVersion,
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
  devDependencies['@nx/vite'] = nxVersion;
  devDependencies['vite'] = viteVersion;
  devDependencies['vitest'] = vitestVersion;
  devDependencies['@vitest/ui'] = vitestUiVersion;

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

function moveToDevDependencies(tree: Tree) {
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
      tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    })
  );

  tasks.push(checkDependenciesInstalled(tree, schema));
  return runTasksInSerial(...tasks);
}

export default initGenerator;
