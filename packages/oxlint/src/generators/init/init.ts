import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { createNodesV2 } from '../../plugins/plugin';
import { OXLINT_CONFIG_FILENAMES } from '../../utils/config-file';
import { nxVersion, oxlintVersion } from '../../utils/versions';

export interface InitGeneratorSchema {
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  updatePackageScripts?: boolean;
  skipFormat?: boolean;
  addPlugin?: boolean;
}

export async function initGeneratorInternal(
  tree: Tree,
  options: InitGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];

  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.addPlugin ??= addPluginDefault;

  if (options.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/oxlint/plugin',
      createNodesV2,
      {
        targetName: ['lint', 'oxlint', 'oxlint:lint', 'oxlint-lint'],
      },
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
  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults['@nx/oxlint:lint'] ??= {};
  nxJson.targetDefaults['@nx/oxlint:lint'].cache ??= true;
  nxJson.targetDefaults['@nx/oxlint:lint'].inputs ??= [
    'default',
    '{workspaceRoot}/.oxlintrc.json',
    '{workspaceRoot}/.oxlintrc.jsonc',
    '{workspaceRoot}/oxlint.config.ts',
  ];

  updateNxJson(tree, nxJson);
}

function ensureRootConfig(tree: Tree) {
  if (OXLINT_CONFIG_FILENAMES.some((file) => tree.exists(file))) {
    return;
  }

  writeJson(tree, '.oxlintrc.json', {
    $schema: './node_modules/oxlint/configuration_schema.json',
    rules: {},
  });
}

export default initGenerator;
