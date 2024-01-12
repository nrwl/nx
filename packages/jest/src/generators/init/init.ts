import {
  addDependenciesToPackageJson,
  formatFiles,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  updateNxJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { jestVersion, nxVersion } from '../../utils/versions';
import type { JestInitSchema } from './schema';

function addPlugin(tree: Tree) {
  const nxJson = readNxJson(tree);

  nxJson.plugins ??= [];
  if (
    !nxJson.plugins.some((p) =>
      typeof p === 'string'
        ? p === '@nx/jest/plugin'
        : p.plugin === '@nx/jest/plugin'
    )
  ) {
    nxJson.plugins.push({
      plugin: '@nx/jest/plugin',
      options: {
        targetName: 'test',
      },
    });
  }
  updateNxJson(tree, nxJson);
}

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

function addJestTargetDefaults(tree: Tree, hasPlugin: boolean) {
  const nxJson = readNxJson(tree);

  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults['@nx/jest:jest'] ??= {};

  if (!hasPlugin) {
    const productionFileSet = nxJson.namedInputs?.production;

    nxJson.targetDefaults['@nx/jest:jest'].cache ??= true;
    // Test targets depend on all their project's sources + production sources of dependencies
    nxJson.targetDefaults['@nx/jest:jest'].inputs ??= [
      'default',
      productionFileSet ? '^production' : '^default',
      '{workspaceRoot}/jest.preset.js',
    ];
  }

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

function updateDependencies(tree: Tree) {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/jest': nxVersion,
      jest: jestVersion,
    }
  );
}

export async function jestInitGenerator(
  tree: Tree,
  options: JestInitSchema
): Promise<GeneratorCallback> {
  if (!tree.exists('jest.preset.js')) {
    const shouldAddPlugin = process.env.NX_PCV3 === 'true';
    if (shouldAddPlugin) {
      addPlugin(tree);
    }

    updateProductionFileSet(tree);
    addJestTargetDefaults(tree, shouldAddPlugin);
  }

  const tasks: GeneratorCallback[] = [];
  if (!options.skipPackageJson) {
    tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/jest'], []));
    tasks.push(updateDependencies(tree));
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default jestInitGenerator;
