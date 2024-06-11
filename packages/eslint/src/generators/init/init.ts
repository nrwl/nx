import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  GeneratorCallback,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { eslintVersion, nxVersion } from '../../utils/versions';
import { findEslintFile } from '../utils/eslint-file';
import { createNodesV2 } from '../../plugins/plugin';
import { hasEslintPlugin } from '../utils/plugin';

export interface LinterInitOptions {
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  updatePackageScripts?: boolean;
  addPlugin?: boolean;
}

function updateProductionFileset(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    productionFileSet.push('!{projectRoot}/.eslintrc.json');
    productionFileSet.push('!{projectRoot}/eslint.config.js');
    // Dedupe and set
    nxJson.namedInputs.production = Array.from(new Set(productionFileSet));
  }
  updateNxJson(tree, nxJson);
}

function addTargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  nxJson.targetDefaults ??= {};
  nxJson.targetDefaults['@nx/eslint:lint'] ??= {};
  nxJson.targetDefaults['@nx/eslint:lint'].cache ??= true;
  nxJson.targetDefaults['@nx/eslint:lint'].inputs ??= [
    'default',
    `{workspaceRoot}/.eslintrc.json`,
    `{workspaceRoot}/.eslintignore`,
    `{workspaceRoot}/eslint.config.js`,
  ];
  updateNxJson(tree, nxJson);
}

export async function initEsLint(
  tree: Tree,
  options: LinterInitOptions
): Promise<GeneratorCallback> {
  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;
  const hasPlugin = hasEslintPlugin(tree);
  const rootEslintFile = findEslintFile(tree);

  const graph = await createProjectGraphAsync();

  const lintTargetNames = [
    'lint',
    'eslint:lint',
    'eslint-lint',
    '_lint',
    '_eslint:lint',
    '_eslint-lint',
  ];

  if (rootEslintFile && options.addPlugin && !hasPlugin) {
    await addPlugin(
      tree,
      graph,
      '@nx/eslint/plugin',
      createNodesV2,
      {
        targetName: lintTargetNames,
      },
      options.updatePackageScripts
    );

    return () => {};
  }

  if (rootEslintFile) {
    return () => {};
  }

  updateProductionFileset(tree);

  if (options.addPlugin) {
    await addPlugin(
      tree,
      graph,
      '@nx/eslint/plugin',
      createNodesV2,
      {
        targetName: lintTargetNames,
      },
      options.updatePackageScripts
    );
  } else {
    addTargetDefaults(tree);
  }

  const tasks: GeneratorCallback[] = [];
  if (!options.skipPackageJson) {
    tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/eslint'], []));
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@nx/eslint': nxVersion,
          eslint: eslintVersion,
        },
        undefined,
        options.keepExistingVersions
      )
    );
  }

  return runTasksInSerial(...tasks);
}

export async function lintInitGenerator(
  tree: Tree,
  options: LinterInitOptions
) {
  return await initEsLint(tree, { addPlugin: false, ...options });
}
