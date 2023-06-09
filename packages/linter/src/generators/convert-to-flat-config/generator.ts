import {
  formatFiles,
  getProjects,
  ProjectConfiguration,
  Tree,
  readJson,
  updateNxJson,
  updateProjectConfiguration,
  names,
} from '@nx/devkit';
import { ConvertToFlatConfigGeneratorSchema } from './schema';
import { findEslintFile } from '../utils/eslint-file';
import { join } from 'path';
import { ESLint } from 'eslint';

export async function convertToFlatConfigGenerator(
  tree: Tree,
  options: ConvertToFlatConfigGeneratorSchema
) {
  const eslintFile = findEslintFile(tree);
  if (!eslintFile) {
    throw new Error('Could not find root eslint file');
  }
  if (!eslintFile.endsWith('.json')) {
    throw new Error(
      'Only json eslint config files are supported for conversion'
    );
  }

  // rename root eslint config to eslint.config.js
  convertRootToFlatConfig(tree);
  // rename and map files
  const projects = getProjects(tree);
  for (const [project, projectConfig] of projects) {
    convertProjectToFlatConfig(tree, project, projectConfig);
  }
  // replace references in nx.json
  updateNxJsonConfig(tree);
  // install missing packages

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default convertToFlatConfigGenerator;

function convertRootToFlatConfig(tree: Tree) {
  if (tree.exists('.eslintrc.base.json')) {
    mapEslintJsonToFlatConfig(
      tree,
      '',
      '.eslintrc.base.json',
      'eslint.config.base.js'
    );
  }
  if (tree.exists('.eslintrc.json')) {
    mapEslintJsonToFlatConfig(tree, '', '.eslintrc.json', 'eslint.config.js');
  }
}

function convertProjectToFlatConfig(
  tree: Tree,
  project: string,
  projectConfig: ProjectConfiguration
) {
  if (tree.exists(`${projectConfig.root}/.eslintrc.json`)) {
    if (projectConfig.targets) {
      const eslintTargets = Object.keys(projectConfig.targets).filter(
        (t) => projectConfig.targets[t].executor === '@nrwl/linter:eslint'
      );
      for (const target of eslintTargets) {
        projectConfig.targets[target].options = {
          ...projectConfig.targets[target].options,
          eslintConfig: `${projectConfig.root}/eslint.config.js`,
        };
      }
      updateProjectConfiguration(tree, project, projectConfig);
    }

    mapEslintJsonToFlatConfig(
      tree,
      projectConfig.root,
      '.eslintrc.json',
      'eslint.config.js'
    );
  }
}

function mapEslintJsonToFlatConfig(
  tree: Tree,
  root: string,
  source: string,
  destination: string
) {
  const config: ESLint.ConfigData = readJson(tree, `${root}/${source}`);

  const extendsConfig = config.extends
    ? Array.isArray(config.extends)
      ? config.extends
      : [config.extends]
    : [];
  const baseExtends = extendsConfig
    .filter((e) => e.startsWith('.'))
    .map((e, index) => ({
      imp: `const baseConfig${index ?? ''} = require('${e}');`,
      config: `...baseConfig${index ?? ''},`,
    }));
  // tODO map plugins to classname imports
  const newConfig = `
${baseExtends
  .map((b) => `${b.imp}\n`)
  .join()}import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
${baseExtends.map((b) => `${b.config}\n`).join()}${mapExtends(
    extendsConfig
  )}${mapIgnores(config)}${mapESLintIgnores(
    tree,
    root
  )}${mapPluginsRulesAndSettings(config)}${mapOverrides(config)}
];
`;

  tree.delete(join(root, source));
  tree.delete(join(root, '.eslintignore'));
  tree.write(join(root, destination), newConfig);
}

function mapExtends(extendsConfig: string[]): string {
  const pluginExtends = extendsConfig.filter((e) => e.startsWith('plugin:'));
  if (pluginExtends.length === 0) {
    return '';
  }
  return `...compat.extends(${pluginExtends
    .map((e) => `'${e}'`)
    .join(', ')}),\n`;
}

function mapIgnores(config: ESLint.ConfigData): string {
  if (!config.ignorePatterns) {
    return '';
  }
  return `{
    ignores: [${config.ignorePatterns}]
  },\n`;
}

function mapESLintIgnores(tree: Tree, root: string): string {
  if (!tree.exists(`${root}/.eslintignore`)) {
    return '';
  }
  const ignores = tree
    .read(`${root}/.eslintignore`, 'utf-8')
    .split('\n')
    .map((i) => `'${i}'`)
    .join(', ');
  return `{
    ignores: [${ignores}]
  },\n`;
}

function mapPluginsRulesAndSettings(config: ESLint.ConfigData): string {
  if (!config.plugins) {
    return '';
  }
  let result = '';
  if (config.plugins) {
    result += `plugins: {\n${config.plugins
      .map((p) => `'${p}': ${names(p).className},\n'`)
      .join()}\n},\n`;
  }
  if (config.rules) {
    result += `rules: {\n${Object.keys(config.rules)
      .map((r) => `${r}: ${JSON.stringify(config.rules[r])},\n`)
      .join()}\n},\n`;
  }
  if (config.settings) {
    result += `settings: {\n${Object.keys(config.settings)
      .map((s) => `${s}: ${JSON.stringify(config.settings[s])},\n`)
      .join()}\n},\n`;
  }
  return `{\n${result}\n},\n`;
}

function mapOverrides(config: ESLint.ConfigData): string {
  if (!config.overrides) {
    return '';
  }
  // TODO map parsers and parserOptions
  return config.overrides.map((o) => `${JSON.stringify(o)},\n`).join();
}

function updateNxJsonConfig(tree) {
  if (tree.exists('nx.json')) {
    const content = tree.read('nx.json', 'utf-8');
    const strippedConfig: string = content
      .replace('.eslintrc.json', 'eslint.config.js')
      .replace('.eslintrc.base.json', 'eslint.config.base.js')
      .replace(/".*\.eslintignore.json",?/, '');
    updateNxJson(tree, JSON.parse(strippedConfig));
  }
}
