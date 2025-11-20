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
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { InitGeneratorSchema } from './schema';
import {
  nxVersion,
  vitestVersion,
  viteV5Version,
  viteV6Version,
  viteVersion,
} from '../../utils/versions';
import { createNodesV2 } from '../../plugins/plugin';
import { ignoreVitestTempFiles } from '../../utils/ignore-vitest-temp-files';

export function updateDependencies(tree: Tree, schema: InitGeneratorSchema) {
  const viteVersionToUse = schema.viteVersion
    ? schema.viteVersion === 5
      ? viteV5Version
      : schema.viteVersion === 6
      ? viteV6Version
      : viteVersion
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

export function initGenerator(tree: Tree, schema: InitGeneratorSchema) {
  return initGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function initGeneratorInternal(
  tree: Tree,
  schema: InitGeneratorSchema
) {
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
