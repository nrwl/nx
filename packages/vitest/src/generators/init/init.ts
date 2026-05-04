import { addPlugin } from '@nx/devkit/internal';
import {
  type Tree,
  type GeneratorCallback,
  readNxJson,
  addDependenciesToPackageJson,
  formatFiles,
  runTasksInSerial,
  updateNxJson,
  createProjectGraphAsync,
} from '@nx/devkit';
import { InitGeneratorSchema } from './schema';
import {
  nxVersion,
  vitestVersion,
  viteV5Version,
  viteV6Version,
  viteV7Version,
  viteVersion,
} from '../../utils/versions';
import { createNodesV2 } from '../../plugins/plugin';
import { getInstalledViteMajorVersion } from '../../utils/version-utils';
import { ignoreVitestTempFiles } from '../../utils/ignore-vitest-temp-files';

export function updateDependencies(tree: Tree, schema: InitGeneratorSchema) {
  // Determine which vite version to install:
  // 1. Explicit viteVersion flag takes priority
  // 2. If vite is already installed, keep the matching major version
  // 3. Otherwise, use the latest default (^8.0.0)
  const installedMajor =
    schema.viteVersion ?? getInstalledViteMajorVersion(tree);
  const viteVersionToUse =
    installedMajor === 5
      ? viteV5Version
      : installedMajor === 6
        ? viteV6Version
        : installedMajor === 7
          ? viteV7Version
          : viteVersion;

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/vitest': nxVersion,
      vitest: vitestVersion,
      vite: viteVersionToUse,
    },
    undefined,
    schema.keepExistingVersions
  );
}

export function updateNxJsonSettings(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    productionFileSet.push(
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      '!{projectRoot}/tsconfig.spec.json'
    );

    nxJson.namedInputs.production = Array.from(new Set(productionFileSet));
  }

  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string' ? p === '@nx/vitest' : p.plugin === '@nx/vitest'
  );

  if (!hasPlugin) {
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['@nx/vitest:test'] ??= {};
    nxJson.targetDefaults['@nx/vitest:test'].cache ??= true;
    nxJson.targetDefaults['@nx/vitest:test'].inputs ??= [
      'default',
      productionFileSet ? '^production' : '^default',
    ];
  }

  updateNxJson(tree, nxJson);
}

export async function initGenerator(tree: Tree, schema: InitGeneratorSchema) {
  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  schema.addPlugin ??= addPluginDefault;

  if (schema.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/vitest',
      createNodesV2,
      {
        testTargetName: ['test', 'vitest:test', 'vitest-test'],
        ciTargetName: ['test-ci', 'vitest:test-ci', 'vitest-test-ci'],
      },
      schema.updatePackageScripts
    );
  }

  updateNxJsonSettings(tree);
  await ignoreVitestTempFiles(tree, schema.projectRoot);

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson) {
    tasks.push(updateDependencies(tree, schema));
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default initGenerator;
