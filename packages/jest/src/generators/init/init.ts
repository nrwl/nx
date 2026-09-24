import { acknowledgeBuildScripts, addPlugin } from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  detectPackageManager,
  formatFiles,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  updateNxJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { createNodesV2 } from '../../plugins/plugin';
import { getPresetExt } from '../../utils/config/config-file';
import { assertSupportedJestVersion } from '../../utils/assert-supported-jest-version';
import { versions } from '../../utils/versions';
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

function updateDependencies(tree: Tree, options: JestInitSchema) {
  const { jestVersion, nxVersion } = versions(tree);

  // jest-resolve depends on unrs-resolver, and from jest 30.5.0 it pins a
  // jest-haste-map that depends on @parcel/watcher. Neither build is needed:
  // the binding has a fallback and the watcher ships prebuilt.
  acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
    '@parcel/watcher': false,
    'unrs-resolver': false,
  });

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/jest': nxVersion,
      jest: jestVersion,
    },
    undefined,
    options.keepExistingVersions ?? true
  );
}

export function jestInitGenerator(tree: Tree, options: JestInitSchema) {
  return jestInitGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function jestInitGeneratorInternal(
  tree: Tree,
  options: JestInitSchema
): Promise<GeneratorCallback> {
  assertSupportedJestVersion(tree);

  const nxJson = readNxJson(tree);
  options.addPlugin = true;

  const presetExt = getPresetExt(tree);

  if (!tree.exists(`jest.preset.${presetExt}`)) {
    updateProductionFileSet(tree);
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
