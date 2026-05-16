import {
  addPlugin,
  normalizeTargetDefaults,
  upsertTargetDefault,
} from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  updateNxJson,
  type GeneratorCallback,
  type TargetDefaultEntry,
  type TargetConfiguration,
  type TargetDefaults,
  type Tree,
} from '@nx/devkit';
import { createNodesV2 } from '../../plugins/plugin';
import {
  getPresetExt,
  type JestPresetExtension,
} from '../../utils/config/config-file';
import {
  getInstalledJestVersion,
  validateInstalledJestVersion,
  versions,
} from '../../utils/versions';
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
  const nxJson = readNxJson(tree) ?? {};
  const productionFileSet = nxJson.namedInputs?.production;
  const existingEntries = findExistingJestDefaults(nxJson.targetDefaults);

  if (existingEntries.length === 0) {
    const patch = createJestDefaultPatch(
      undefined,
      productionFileSet,
      presetExt
    );
    if (Object.keys(patch).length > 0) {
      upsertTargetDefault(tree, nxJson, {
        executor: '@nx/jest:jest',
        ...patch,
      });
      updateNxJson(tree, nxJson);
    }
    return;
  }

  let didUpdate = false;
  for (const existing of existingEntries) {
    const patch = createJestDefaultPatch(
      existing,
      productionFileSet,
      presetExt
    );
    if (Object.keys(patch).length === 0) {
      continue;
    }

    upsertTargetDefault(tree, nxJson, {
      target: existing.target,
      executor: existing.executor,
      projects: existing.projects,
      plugin: existing.plugin,
      ...patch,
    });
    didUpdate = true;
  }

  if (didUpdate) {
    updateNxJson(tree, nxJson);
  }
}

function createJestDefaultPatch(
  existing: Partial<TargetConfiguration> | undefined,
  productionFileSet: unknown,
  presetExt: JestPresetExtension
): Partial<TargetConfiguration> {
  const patch: Partial<TargetConfiguration> = {};
  if (existing?.cache === undefined) patch.cache = true;
  // Test targets depend on all their project's sources + production sources of dependencies
  if (existing?.inputs === undefined) {
    patch.inputs = [
      'default',
      productionFileSet ? '^production' : '^default',
      `{workspaceRoot}/jest.preset.${presetExt}`,
    ];
  }
  if (existing?.options === undefined) {
    patch.options = { passWithNoTests: true };
  }
  if (existing?.configurations === undefined) {
    patch.configurations = {
      ci: {
        ci: true,
        codeCoverage: true,
      },
    };
  }

  return patch;
}

function findExistingJestDefaults(
  td: TargetDefaults | undefined
): TargetDefaultEntry[] {
  return normalizeTargetDefaults(td).filter(
    (e) => e.executor === '@nx/jest:jest'
  );
}

function updateDependencies(tree: Tree, options: JestInitSchema) {
  const { jestVersion, nxVersion } = versions(tree);

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
  const installedJestVersion = getInstalledJestVersion(tree);
  if (installedJestVersion) {
    validateInstalledJestVersion(tree);
  }

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
