import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  TargetConfiguration,
  Tree,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import {
  addPlugin,
  assertSupportedPackageVersion,
  findTargetDefault,
  upsertTargetDefault,
} from '@nx/devkit/internal';
import { createNodes } from '../../plugins/plugin.js';
import { OXLINT_CONFIG_FILENAMES } from '../../utils/config-file.js';
import {
  minSupportedOxlintVersion,
  nxVersion,
  oxlintVersion,
} from '../../utils/versions.js';

export interface InitGeneratorSchema {
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  updatePackageScripts?: boolean;
  skipFormat?: boolean;
  addPlugin?: boolean;
}

/**
 * `lint` first so greenfield workspaces get the natural name; `addPlugin`
 * falls through the rest when ESLint already owns `lint`.
 */
const OXLINT_TARGET_NAMES = ['lint', 'oxlint', 'oxlint:lint', 'oxlint-lint'];

export async function initGeneratorInternal(
  tree: Tree,
  options: InitGeneratorSchema
) {
  assertSupportedPackageVersion(tree, 'oxlint', minSupportedOxlintVersion);

  const tasks: GeneratorCallback[] = [];

  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson?.useInferencePlugins !== false;

  options.addPlugin ??= addPluginDefault;

  if (options.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/oxlint/plugin',
      createNodes,
      { targetName: OXLINT_TARGET_NAMES },
      options.updatePackageScripts
    );
  } else {
    addTargetDefaults(tree);
  }

  ensureRootConfig(tree);

  if (!options.skipPackageJson) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/oxlint': nxVersion,
          oxlint: oxlintVersion,
        },
        undefined,
        options.keepExistingVersions
      )
    );
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  return initGeneratorInternal(tree, { addPlugin: false, ...options });
}

function addTargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);
  const existing = findTargetDefault(nxJson.targetDefaults, {
    executor: '@nx/oxlint:lint',
  });

  const patch: Partial<TargetConfiguration> = {};
  if (existing?.cache === undefined) {
    patch.cache = true;
  }
  if (existing?.inputs === undefined) {
    patch.inputs = [
      'default',
      '^default',
      ...OXLINT_CONFIG_FILENAMES.map((file) => `{workspaceRoot}/${file}`),
      { externalDependencies: ['oxlint'] },
    ];
  }

  if (Object.keys(patch).length > 0) {
    upsertTargetDefault(tree, nxJson, {
      executor: '@nx/oxlint:lint',
      ...patch,
    });
    updateNxJson(tree, nxJson);
  }
}

function ensureRootConfig(tree: Tree) {
  if (OXLINT_CONFIG_FILENAMES.some((file) => tree.exists(file))) {
    return;
  }

  writeJson(tree, '.oxlintrc.json', {
    $schema:
      'https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json',
    rules: {},
  });
}

export default initGenerator;
