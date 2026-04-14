import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  getDependencyVersionFromPackageJson,
  getProjects,
  installPackagesTask,
  logger,
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
import { hasEslintPlugin } from '../utils/plugin';
import { join } from 'path';
import {
  eslint9__eslintVersion,
  eslint9__typescriptESLintVersion,
  eslintConfigPrettierVersion,
  eslintrcVersion,
  eslintVersion,
} from '../../utils/versions';
import { ESLint } from 'eslint';
import { convertEslintJsonToFlatConfig } from './converters/json-converter';

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

  options.eslintConfigFormat ??= 'mjs';

  const eslintIgnoreFiles = new Set<string>(['.eslintignore']);

  // convert root eslint config to eslint.config.cjs or eslint.base.config.mjs based on eslintConfigFormat
  convertRootToFlatConfig(tree, eslintFile, options.eslintConfigFormat);

  // convert project eslint files to eslint.config.cjs
  const projects = getProjects(tree);
  for (const [project, projectConfig] of projects) {
    convertProjectToFlatConfig(
      tree,
      project,
      projectConfig,
      readNxJson(tree),
      eslintIgnoreFiles,
      options.eslintConfigFormat
    );
  }

  // delete all .eslintignore files
  for (const ignoreFile of eslintIgnoreFiles) {
    tree.delete(ignoreFile);
  }

  // replace references in nx.json
  updateNxJsonConfig(tree, options.eslintConfigFormat);
  // install missing packages

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => installPackagesTask(tree);
}

export default convertToFlatConfigGenerator;

function convertRootToFlatConfig(
  tree: Tree,
  eslintFile: string,
  format: 'cjs' | 'mjs'
) {
  if (/\.base\.(js|json|yml|yaml)$/.test(eslintFile)) {
    convertConfigToFlatConfig(
      tree,
      '',
      eslintFile,
      `eslint.base.config.${format}`,
      format
    );
  }
  convertConfigToFlatConfig(
    tree,
    '',
    eslintFile.replace('.base.', '.'),
    `eslint.config.${format}`,
    format
  );
}

const ESLINT_LINT_EXECUTOR = '@nx/eslint:lint';

function isEslintTarget(target: { executor?: string; command?: string }) {
  return (
    target.executor === ESLINT_LINT_EXECUTOR ||
    target.command?.includes('eslint')
  );
}

function convertProjectToFlatConfig(
  tree: Tree,
  project: string,
  projectConfig: ProjectConfiguration,
  nxJson: NxJsonConfiguration,
  eslintIgnoreFiles: Set<string>,
  format: 'cjs' | 'mjs'
) {
  const eslintFile = findEslintFile(tree, projectConfig.root);
  if (!eslintFile || eslintFile.endsWith('.js')) {
    return;
  }

  // Clean up obsolete target options and detect explicit ESLint targets
  let ignorePath: string | undefined;
  const eslintTargets = projectConfig.targets
    ? Object.keys(projectConfig.targets).filter((t) =>
        isEslintTarget(projectConfig.targets[t])
      )
    : [];
  for (const target of eslintTargets) {
    if (projectConfig.targets[target].options?.eslintConfig) {
      delete projectConfig.targets[target].options.eslintConfig;
    }
    if (projectConfig.targets[target].options?.ignorePath) {
      ignorePath = projectConfig.targets[target].options.ignorePath;
      delete projectConfig.targets[target].options.ignorePath;
    }
  }
  if (eslintTargets.length > 0) {
    updateProjectConfiguration(tree, project, projectConfig);
  }
  const hasEslintTargetDefaults =
    projectConfig.targets &&
    Object.keys(nxJson.targetDefaults || {}).some(
      (t) =>
        (t === ESLINT_LINT_EXECUTOR ||
          isEslintTarget(nxJson.targetDefaults[t])) &&
        projectConfig.targets[t]
    );

  if (
    eslintTargets.length === 0 &&
    !hasEslintTargetDefaults &&
    !hasEslintPlugin(tree)
  ) {
    logger.warn(
      `Skipping "${project}": found ${eslintFile} but no ESLint lint target detected. Convert manually if needed.`
    );
    return;
  }

  convertConfigToFlatConfig(
    tree,
    projectConfig.root,
    eslintFile,
    `eslint.config.${format}`,
    format,
    ignorePath
  );
  eslintIgnoreFiles.add(`${projectConfig.root}/.eslintignore`);
  if (ignorePath) {
    eslintIgnoreFiles.add(ignorePath);
  }
}

// update names of eslint files in nx.json
// and remove eslintignore
function updateNxJsonConfig(tree: Tree, format: 'cjs' | 'mjs') {
  if (tree.exists('nx.json')) {
    updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
      if (json.targetDefaults?.lint?.inputs) {
        const inputSet = new Set(json.targetDefaults.lint.inputs);
        inputSet.add(`{workspaceRoot}/eslint.config.${format}`);
        json.targetDefaults.lint.inputs = Array.from(inputSet);
      }
      if (json.targetDefaults?.['@nx/eslint:lint']?.inputs) {
        const inputSet = new Set(json.targetDefaults['@nx/eslint:lint'].inputs);
        inputSet.add(`{workspaceRoot}/eslint.config.${format}`);
        json.targetDefaults['@nx/eslint:lint'].inputs = Array.from(inputSet);
      }
      if (json.namedInputs?.production) {
        const inputSet = new Set(json.namedInputs.production);
        inputSet.add(`!{projectRoot}/eslint.config.${format}`);
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
  format: 'cjs' | 'mjs',
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
      ignorePaths,
      format
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
      ignorePaths,
      format
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

  // These dependencies are required for flat configs that are generated by subsequent app/lib generators.
  const devDependencies: Record<string, string> = {
    eslint: eslint9__eslintVersion,
    'eslint-config-prettier': eslintConfigPrettierVersion,
    'typescript-eslint': eslint9__typescriptESLintVersion,
    '@typescript-eslint/eslint-plugin': eslint9__typescriptESLintVersion,
    '@typescript-eslint/parser': eslint9__typescriptESLintVersion,
  };

  if (getDependencyVersionFromPackageJson(tree, '@typescript-eslint/utils')) {
    devDependencies['@typescript-eslint/utils'] =
      eslint9__typescriptESLintVersion;
  }
  if (
    getDependencyVersionFromPackageJson(tree, '@typescript-eslint/type-utils')
  ) {
    devDependencies['@typescript-eslint/type-utils'] =
      eslint9__typescriptESLintVersion;
  }

  // add missing packages
  if (addESLintRC) {
    devDependencies['@eslint/eslintrc'] = eslintrcVersion;
  }

  if (addESLintJS) {
    devDependencies['@eslint/js'] = eslintVersion;
  }

  addDependenciesToPackageJson(tree, {}, devDependencies);
}
