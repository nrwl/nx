import { joinPathFragments, Tree, updateJson } from '@nx/devkit';
import { Linter } from 'eslint';
import { useFlatConfig } from '../../utils/flat-config';
import {
  addConfigToFlatConfigExport,
  generateFlatOverride,
  generatePluginExtendsElement,
} from './flat-config/ast-utils';

export const eslintConfigFileWhitelist = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc.json',
  'eslint.config.js',
];

export const baseEsLintConfigFile = '.eslintrc.base.json';

export function findEslintFile(tree: Tree, projectRoot = ''): string | null {
  if (projectRoot === '' && tree.exists(baseEsLintConfigFile)) {
    return baseEsLintConfigFile;
  }
  for (const file of eslintConfigFileWhitelist) {
    if (tree.exists(joinPathFragments(projectRoot, file))) {
      return file;
    }
  }

  return null;
}

export function addOverrideToLintConfig(
  tree: Tree,
  root: string,
  override: Linter.ConfigOverride<Linter.RulesRecord>
) {
  if (useFlatConfig()) {
    const fileName = joinPathFragments(root, 'eslint.config.js');
    const flatOverride = generateFlatOverride(override);
    tree.write(
      fileName,
      addConfigToFlatConfigExport(tree.read(fileName, 'utf8'), flatOverride)
    );
  } else {
    const fileName = joinPathFragments(root, '.eslintrc.json');
    updateJson(tree, fileName, (json) => {
      json.overrides ?? [];
      json.overrides.push(override);
      return json;
    });
  }
}

export function addExtendsToLintConfig(
  tree: Tree,
  root: string,
  plugin: string
) {
  if (useFlatConfig()) {
    const fileName = joinPathFragments(root, 'eslint.config.js');
    const pluginExtends = generatePluginExtendsElement(plugin);
    tree.write(
      fileName,
      addConfigToFlatConfigExport(tree.read(fileName, 'utf8'), pluginExtends)
    );
  } else {
    const fileName = joinPathFragments(root, '.eslintrc.json');
    updateJson(tree, fileName, (json) => {
      json.extends = [plugin, ...(json.extends ?? [])];
      return json;
    });
  }
}
