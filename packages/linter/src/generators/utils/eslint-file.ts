import { joinPathFragments, Tree, updateJson } from '@nx/devkit';
import { Linter } from 'eslint';
import { useFlatConfig } from '../../utils/flat-config';
import {
  addBlockToFlatConfigExport,
  addCompatToFlatConfig,
  generateAst,
  generateFlatOverride,
  generatePluginExtendsElement,
  mapFilePath,
  removeRulesFromLintConfig,
} from './flat-config/ast-utils';
import ts = require('typescript');

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
    const flatOverride = generateFlatOverride(override, root);
    let content = tree.read(fileName, 'utf8');
    // we will be using compat here so we need to make sure it's added
    if (overrideNeedsCompat(override)) {
      content = addCompatToFlatConfig(content);
    }
    tree.write(fileName, addBlockToFlatConfigExport(content, flatOverride));
  } else {
    const fileName = joinPathFragments(root, '.eslintrc.json');
    updateJson(tree, fileName, (json) => {
      json.overrides ?? [];
      json.overrides.push(override);
      return json;
    });
  }
}

function overrideNeedsCompat(
  override: Linter.ConfigOverride<Linter.RulesRecord>
) {
  return (
    !override.env && !override.extends && !override.plugins && !override.parser
  );
}

export function replaceOverridesInLintConfig(
  tree: Tree,
  root: string,
  overrides: Linter.ConfigOverride<Linter.RulesRecord>[]
) {
  if (useFlatConfig()) {
    const fileName = joinPathFragments(root, 'eslint.config.js');
    let content = tree.read(fileName, 'utf8');
    // we will be using compat here so we need to make sure it's added
    if (overrides.some(overrideNeedsCompat)) {
      content = addCompatToFlatConfig(content);
    }
    content = removeRulesFromLintConfig(content);
    overrides.forEach((override) => {
      const flatOverride = generateFlatOverride(override, root);
      addBlockToFlatConfigExport(content, flatOverride);
    });

    tree.write(fileName, content);
  } else {
    const fileName = joinPathFragments(root, '.eslintrc.json');
    updateJson(tree, fileName, (json) => {
      json.overrides = overrides;
      return json;
    });
  }
}

export function addExtendsToLintConfig(
  tree: Tree,
  root: string,
  plugin: string | string[]
) {
  const plugins = Array.isArray(plugin) ? plugin : [plugin];
  if (useFlatConfig()) {
    const fileName = joinPathFragments(root, 'eslint.config.js');
    const pluginExtends = generatePluginExtendsElement(plugins);
    tree.write(
      fileName,
      addBlockToFlatConfigExport(tree.read(fileName, 'utf8'), pluginExtends)
    );
  } else {
    const fileName = joinPathFragments(root, '.eslintrc.json');
    updateJson(tree, fileName, (json) => {
      json.extends = [...plugins, ...(json.extends ?? [])];
      return json;
    });
  }
}

export function addIgnoresToLintConfig(
  tree: Tree,
  root: string,
  ignorePatterns: string[]
) {
  if (useFlatConfig()) {
    const fileName = joinPathFragments(root, 'eslint.config.js');
    const block = generateAst<ts.ObjectLiteralExpression>({
      ignores: ignorePatterns.map((path) => mapFilePath(path, root)),
    });
    tree.write(
      fileName,
      addBlockToFlatConfigExport(tree.read(fileName, 'utf8'), block)
    );
  } else {
    const fileName = joinPathFragments(root, '.eslintrc.json');
    updateJson(tree, fileName, (json) => {
      const ignoreSet = new Set([
        ...(json.ignorePatterns ?? []),
        ...ignorePatterns,
      ]);
      json.ignorePatterns = Array.from(ignoreSet);
      return json;
    });
  }
}
