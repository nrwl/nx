import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  getProjects,
  installPackagesTask,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJson,
  readNxJson,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { ConvertToFlatConfigGeneratorSchema } from './schema';
import { findEslintFile } from '../utils/eslint-file';
import { join } from 'path';
import { eslintrcVersion, eslintVersion } from '../../utils/versions';
import { ESLint } from 'eslint';
import { convertEslintJsonToFlatConfig } from './converters/json-converter';

let shouldInstallDeps = false;

export async function convertToFlatConfigGenerator(
  tree: Tree,
  options: ConvertToFlatConfigGeneratorSchema
): Promise<void | GeneratorCallback> {
  const eslintFile = findEslintFile(tree);
  if (!eslintFile) {
    throw new Error('Could not find root eslint file');
  }
  if (eslintFile.endsWith('.js')) {
    throw new Error(
      'Only json and yaml eslint config files are supported for conversion'
    );
  }

  const eslintIgnoreFiles = new Set<string>(['.eslintignore']);

  // convert root eslint config to eslint.config.js
  convertRootToFlatConfig(tree, eslintFile);

  // convert project eslint files to eslint.config.js
  const projects = getProjects(tree);
  for (const [project, projectConfig] of projects) {
    convertProjectToFlatConfig(
      tree,
      project,
      projectConfig,
      readNxJson(tree),
      eslintIgnoreFiles
    );
  }

  // delete all .eslintignore files
  for (const ignoreFile of eslintIgnoreFiles) {
    tree.delete(ignoreFile);
  }

  // replace references in nx.json
  updateNxJsonConfig(tree);
  // install missing packages

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  if (shouldInstallDeps) {
    return () => installPackagesTask(tree);
  }
}

export default convertToFlatConfigGenerator;

function convertRootToFlatConfig(tree: Tree, eslintFile: string) {
  if (/\.base\.(js|json|yml|yaml)$/.test(eslintFile)) {
    convertConfigToFlatConfig(tree, '', eslintFile, 'eslint.base.config.js');
  }
  convertConfigToFlatConfig(
    tree,
    '',
    eslintFile.replace('.base.', '.'),
    'eslint.config.js'
  );
}

function convertProjectToFlatConfig(
  tree: Tree,
  project: string,
  projectConfig: ProjectConfiguration,
  nxJson: NxJsonConfiguration,
  eslintIgnoreFiles: Set<string>
) {
  const eslintFile = findEslintFile(tree, projectConfig.root);
  if (eslintFile && !eslintFile.endsWith('.js')) {
    if (projectConfig.targets) {
      const eslintTargets = Object.keys(projectConfig.targets || {}).filter(
        (t) =>
          projectConfig.targets[t].executor === '@nx/eslint:lint' ||
          projectConfig.targets[t].command?.includes('eslint')
      );
      let ignorePath: string | undefined;
      for (const target of eslintTargets) {
        // remove any obsolete `eslintConfig` options pointing to the old config file
        if (projectConfig.targets[target].options?.eslintConfig) {
          delete projectConfig.targets[target].options.eslintConfig;
        }
        if (projectConfig.targets[target].options?.ignorePath) {
          ignorePath = projectConfig.targets[target].options.ignorePath;
          delete projectConfig.targets[target].options.ignorePath;
        }
        updateProjectConfiguration(tree, project, projectConfig);
      }
      const nxHasEsLintTargets = Object.keys(nxJson.targetDefaults || {}).some(
        (t) =>
          (t === '@nx/eslint:lint' ||
            nxJson.targetDefaults[t].executor === '@nx/eslint:lint' ||
            nxJson.targetDefaults[t].command?.includes('eslint')) &&
          projectConfig.targets?.[t]
      );
      const nxHasEsLintPlugin = (nxJson.plugins || []).some((p) =>
        typeof p === 'string'
          ? p === '@nx/eslint/plugin'
          : p.plugin === '@nx/eslint/plugin'
      );

      if (nxHasEsLintTargets || nxHasEsLintPlugin || eslintTargets.length > 0) {
        convertConfigToFlatConfig(
          tree,
          projectConfig.root,
          eslintFile,
          'eslint.config.js',
          ignorePath
        );
        eslintIgnoreFiles.add(`${projectConfig.root}/.eslintignore`);
        if (ignorePath) {
          eslintIgnoreFiles.add(ignorePath);
        }
      }
    }
  }
}

// update names of eslint files in nx.json
// and remove eslintignore
function updateNxJsonConfig(tree: Tree) {
  if (tree.exists('nx.json')) {
    updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
      if (json.targetDefaults?.lint?.inputs) {
        const inputSet = new Set(json.targetDefaults.lint.inputs);
        inputSet.add('{workspaceRoot}/eslint.config.js');
        json.targetDefaults.lint.inputs = Array.from(inputSet);
      }
      if (json.targetDefaults?.['@nx/eslint:lint']?.inputs) {
        const inputSet = new Set(json.targetDefaults['@nx/eslint:lint'].inputs);
        inputSet.add('{workspaceRoot}/eslint.config.js');
        json.targetDefaults['@nx/eslint:lint'].inputs = Array.from(inputSet);
      }
      if (json.namedInputs?.production) {
        const inputSet = new Set(json.namedInputs.production);
        inputSet.add('!{projectRoot}/eslint.config.js');
        json.namedInputs.production = Array.from(inputSet);
      }
      return json;
    });
  }
}

function convertConfigToFlatConfig(
  tree: Tree,
  root: string,
  source: string,
  target: string,
  ignorePath?: string
) {
  const ignorePaths = ignorePath
    ? [ignorePath, `${root}/.eslintignore`]
    : [`${root}/.eslintignore`];

  if (source.endsWith('.json')) {
    const config: ESLint.ConfigData = readJson(tree, `${root}/${source}`);
    const conversionResult = convertEslintJsonToFlatConfig(
      tree,
      root,
      config,
      ignorePaths
    );
    return processConvertedConfig(tree, root, source, target, conversionResult);
  }
  if (source.endsWith('.yaml') || source.endsWith('.yml')) {
    const originalContent = tree.read(`${root}/${source}`, 'utf-8');
    const { load } = require('@zkochan/js-yaml');
    const config = load(originalContent, {
      json: true,
      filename: source,
    }) as ESLint.ConfigData;
    const conversionResult = convertEslintJsonToFlatConfig(
      tree,
      root,
      config,
      ignorePaths
    );
    return processConvertedConfig(tree, root, source, target, conversionResult);
  }
}

function processConvertedConfig(
  tree: Tree,
  root: string,
  source: string,
  target: string,
  {
    content,
    addESLintRC,
    addESLintJS,
  }: { content: string; addESLintRC: boolean; addESLintJS: boolean }
) {
  // remove original config file
  tree.delete(join(root, source));

  // save new
  tree.write(join(root, target), content);

  // add missing packages
  if (addESLintRC) {
    shouldInstallDeps = true;
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@eslint/eslintrc': eslintrcVersion,
      }
    );
  }
  if (addESLintJS) {
    shouldInstallDeps = true;
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@eslint/js': eslintVersion,
      }
    );
  }
}
