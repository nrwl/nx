import { addPlugin, upsertTargetDefault } from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  GeneratorCallback,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  type TargetConfiguration,
  type TargetDefaults,
  Tree,
  updateJson,
  updateNxJson,
} from '@nx/devkit';
import { eslintVersion, nxVersion } from '../../utils/versions';
import {
  determineEslintConfigFormat,
  findEslintFile,
} from '../utils/eslint-file';
import { createNodesV2 } from '../../plugins/plugin';
import { hasEslintPlugin } from '../utils/plugin';
import { extname } from 'path';

export interface LinterInitOptions {
  skipPackageJson?: boolean;
  keepExistingVersions?: boolean;
  updatePackageScripts?: boolean;
  addPlugin?: boolean;
  // Internal option
  eslintConfigFormat?: 'mjs' | 'cjs';
}

function updateProductionFileset(tree: Tree, format: 'mjs' | 'cjs' = 'mjs') {
  const nxJson = readNxJson(tree);

  const productionFileSet = nxJson.namedInputs?.production;
  if (productionFileSet) {
    productionFileSet.push('!{projectRoot}/.eslintrc.json');
    productionFileSet.push(`!{projectRoot}/eslint.config.${format}`);
    // Dedupe and set
    nxJson.namedInputs.production = Array.from(new Set(productionFileSet));
  }
  updateNxJson(tree, nxJson);
}

function addTargetDefaults(tree: Tree, format: 'mjs' | 'cjs') {
  const nxJson = readNxJson(tree);
  const existing = findExistingLintDefault(nxJson?.targetDefaults);
  const patch: Partial<TargetConfiguration> = {};
  if (existing?.cache === undefined) patch.cache = true;
  if (existing?.inputs === undefined) {
    patch.inputs = [
      'default',
      '^default',
      `{workspaceRoot}/.eslintrc.json`,
      `{workspaceRoot}/.eslintignore`,
      `{workspaceRoot}/eslint.config.${format}`,
      '{workspaceRoot}/tools/eslint-rules/**/*',
    ];
  }
  if (Object.keys(patch).length > 0) {
    upsertTargetDefault(tree, { target: '@nx/eslint:lint', ...patch });
  }
}

function findExistingLintDefault(
  td: TargetDefaults | undefined
): Partial<TargetConfiguration> | undefined {
  if (!td) return undefined;
  if (Array.isArray(td)) {
    return td.find(
      (e) =>
        e.target === '@nx/eslint:lint' &&
        e.projects === undefined &&
        e.source === undefined
    );
  }
  return td['@nx/eslint:lint'];
}

function updateVsCodeRecommendedExtensions(host: Tree) {
  if (!host.exists('.vscode/extensions.json')) {
    return;
  }

  updateJson(host, '.vscode/extensions.json', (json) => {
    json.recommendations = json.recommendations || [];
    const extension = 'dbaeumer.vscode-eslint';
    if (!json.recommendations.includes(extension)) {
      json.recommendations.push(extension);
    }
    return json;
  });
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
  options.eslintConfigFormat ??= 'mjs';
  const hasPlugin = hasEslintPlugin(tree);
  const rootEslintFile = findEslintFile(tree);

  if (rootEslintFile) {
    const fileExtension = extname(rootEslintFile);
    if (fileExtension === '.mjs' || fileExtension === '.cjs') {
      options.eslintConfigFormat = fileExtension.slice(1) as 'mjs' | 'cjs';
    } else {
      options.eslintConfigFormat = determineEslintConfigFormat(
        tree.read(rootEslintFile, 'utf-8')
      );
    }
  }

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

  updateProductionFileset(tree, options.eslintConfigFormat);

  updateVsCodeRecommendedExtensions(tree);

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
    addTargetDefaults(tree, options.eslintConfigFormat);
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
