import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  updateNxJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { createNodesV2 } from '../../plugins/plugin';
import {
  getPresetExt,
  type JestPresetExtension,
} from '../../utils/config/config-file';
import { jestVersion, nxVersion } from '../../utils/versions';
import type { JestInitSchema } from './schema';

function updateProductionFileSet(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    // This is one of the patterns in the default jest patterns
    productionFileSet.push(
      // Remove spec, test, and snapshots from the production fileset
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      // Remove tsconfig.spec.json
      '!{projectRoot}/tsconfig.spec.json',
      // Remove jest.config.js/ts
      '!{projectRoot}/jest.config.[jt]s',
      // Remove test-setup.js/ts
      // TODO(meeroslav) this should be standardized
      '!{projectRoot}/src/test-setup.[jt]s',
      '!{projectRoot}/test-setup.[jt]s'
    );
    // Dedupe and set
    nxJson.namedInputs.production = Array.from(new Set(productionFileSet));
  }

  updateNxJson(tree, nxJson);
}

function addJestTargetDefaults(tree: Tree, presetExt: JestPresetExtension) {
  const nxJson = readNxJson(tree);

  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults['@nx/jest:jest'] ??= {};

  const productionFileSet = nxJson.namedInputs?.production;

  nxJson.targetDefaults['@nx/jest:jest'].cache ??= true;
  // Test targets depend on all their project's sources + production sources of dependencies
  nxJson.targetDefaults['@nx/jest:jest'].inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
    `{workspaceRoot}/jest.preset.${presetExt}`,
  ];

  nxJson.targetDefaults['@nx/jest:jest'].options ??= {
    passWithNoTests: true,
  };
  nxJson.targetDefaults['@nx/jest:jest'].configurations ??= {
    ci: {
      ci: true,
      codeCoverage: true,
    },
  };

  updateNxJson(tree, nxJson);
}

function updateDependencies(tree: Tree, options: JestInitSchema) {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/jest': nxVersion,
      jest: jestVersion,
    },
    undefined,
    options.keepExistingVersions
  );
}

export function jestInitGenerator(tree: Tree, options: JestInitSchema) {
  return jestInitGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function jestInitGeneratorInternal(
  tree: Tree,
  options: JestInitSchema
): Promise<GeneratorCallback> {
  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;

  const presetExt = getPresetExt(tree);

  if (!tree.exists(`jest.preset.${presetExt}`)) {
    updateProductionFileSet(tree);
    if (options.addPlugin) {
      await addPlugin(
        tree,
        await createProjectGraphAsync(),
        '@nx/jest/plugin',
        createNodesV2,
        {
          targetName: ['test', 'jest:test', 'jest-test'],
        },
        options.updatePackageScripts
      );
    } else {
      addJestTargetDefaults(tree, presetExt);
    }
  }

  const tasks: GeneratorCallback[] = [];
  if (!options.skipPackageJson) {
    tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/jest'], []));
    tasks.push(updateDependencies(tree, options));
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default jestInitGenerator;
