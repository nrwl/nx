import {
  joinPathFragments,
  names,
  readJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { Linter } from 'eslint';
import { useFlatConfig } from '../../utils/flat-config';
import {
  addBlockToFlatConfigExport,
  addCompatToFlatConfig,
  addImportToFlatConfig,
  addPluginsToExportsBlock,
  generateAst,
  generateFlatOverride,
  generatePluginExtendsElement,
  hasOverride,
  mapFilePath,
  removeOverridesFromLintConfig,
  replaceOverride,
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
export const baseEsLintFlatConfigFile = 'eslint.base.config.js';

export function findEslintFile(tree: Tree, projectRoot = ''): string | null {
  if (projectRoot === '' && tree.exists(baseEsLintConfigFile)) {
    return baseEsLintConfigFile;
  }
  if (projectRoot === '' && tree.exists(baseEsLintFlatConfigFile)) {
    return baseEsLintFlatConfigFile;
  }
  for (const file of eslintConfigFileWhitelist) {
    if (tree.exists(joinPathFragments(projectRoot, file))) {
      return file;
    }
  }

  return null;
}

export function isMigrationSupported(tree: Tree, projectRoot = ''): boolean {
  const eslintFile = findEslintFile(tree, projectRoot);
  if (!eslintFile) {
    return;
  }
  return eslintFile.endsWith('.json') || eslintFile.endsWith('.config.js');
}

export function addOverrideToLintConfig(
  tree: Tree,
  root: string,
  override: Linter.ConfigOverride<Linter.RulesRecord>,
  options: { insertAtTheEnd?: boolean; checkBaseConfig?: boolean } = {
    insertAtTheEnd: true,
  }
) {
  const isBase =
    options.checkBaseConfig && findEslintFile(tree, root).includes('.base');
  if (useFlatConfig(tree)) {
    const fileName = joinPathFragments(
      root,
      isBase ? baseEsLintFlatConfigFile : 'eslint.config.js'
    );
    const flatOverride = generateFlatOverride(override, root);
    let content = tree.read(fileName, 'utf8');
    // we will be using compat here so we need to make sure it's added
    if (overrideNeedsCompat(override)) {
      content = addCompatToFlatConfig(content);
    }
    tree.write(
      fileName,
      addBlockToFlatConfigExport(content, flatOverride, options)
    );
  } else {
    const fileName = joinPathFragments(
      root,
      isBase ? baseEsLintConfigFile : '.eslintrc.json'
    );
    updateJson(tree, fileName, (json) => {
      json.overrides ?? [];
      if (options.insertAtTheEnd) {
        json.overrides.push(override);
      } else {
        json.overrides.unshift(override);
      }
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

export function updateOverrideInLintConfig(
  tree: Tree,
  root: string,
  lookup: (override: Linter.ConfigOverride<Linter.RulesRecord>) => boolean,
  update: (
    override: Linter.ConfigOverride<Linter.RulesRecord>
  ) => Linter.ConfigOverride<Linter.RulesRecord>
) {
  if (useFlatConfig(tree)) {
    const fileName = joinPathFragments(root, 'eslint.config.js');
    let content = tree.read(fileName, 'utf8');
    content = replaceOverride(content, lookup, update);
    tree.write(fileName, content);
  } else {
    const fileName = joinPathFragments(root, '.eslintrc.json');
    updateJson(tree, fileName, (json: Linter.Config) => {
      const index = json.overrides.findIndex(lookup);
      if (index !== -1) {
        json.overrides[index] = update(json.overrides[index]);
      }
      return json;
    });
  }
}

export function lintConfigHasOverride(
  tree: Tree,
  root: string,
  lookup: (override: Linter.ConfigOverride<Linter.RulesRecord>) => boolean,
  checkBaseConfig = false
): boolean {
  const isBase =
    checkBaseConfig && findEslintFile(tree, root).includes('.base');
  if (useFlatConfig(tree)) {
    const fileName = joinPathFragments(
      root,
      isBase ? baseEsLintFlatConfigFile : 'eslint.config.js'
    );
    const content = tree.read(fileName, 'utf8');
    return hasOverride(content, lookup);
  } else {
    const fileName = joinPathFragments(
      root,
      isBase ? baseEsLintConfigFile : '.eslintrc.json'
    );
    return readJson(tree, fileName).overrides?.some(lookup) || false;
  }
}

export function replaceOverridesInLintConfig(
  tree: Tree,
  root: string,
  overrides: Linter.ConfigOverride<Linter.RulesRecord>[]
) {
  if (useFlatConfig(tree)) {
    const fileName = joinPathFragments(root, 'eslint.config.js');
    let content = tree.read(fileName, 'utf8');
    // we will be using compat here so we need to make sure it's added
    if (overrides.some(overrideNeedsCompat)) {
      content = addCompatToFlatConfig(content);
    }
    content = removeOverridesFromLintConfig(content);
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
  if (useFlatConfig(tree)) {
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

export function addPluginsToLintConfig(
  tree: Tree,
  root: string,
  plugin: string | string[]
) {
  const plugins = Array.isArray(plugin) ? plugin : [plugin];
  if (useFlatConfig(tree)) {
    const fileName = joinPathFragments(root, 'eslint.config.js');
    let content = tree.read(fileName, 'utf8');
    const mappedPlugins: { name: string; varName: string; imp: string }[] = [];
    plugins.forEach((name) => {
      const imp = getPluginImport(name);
      const varName = names(imp).propertyName;
      mappedPlugins.push({ name, varName, imp });
    });
    mappedPlugins.forEach(({ varName, imp }) => {
      content = addImportToFlatConfig(content, varName, imp);
    });
    content = addPluginsToExportsBlock(content, mappedPlugins);
    tree.write(fileName, content);
  } else {
    const fileName = joinPathFragments(root, '.eslintrc.json');
    updateJson(tree, fileName, (json) => {
      json.plugins = [...plugins, ...(json.plugins ?? [])];
      return json;
    });
  }
}

export function addIgnoresToLintConfig(
  tree: Tree,
  root: string,
  ignorePatterns: string[]
) {
  if (useFlatConfig(tree)) {
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

export function getPluginImport(pluginName: string): string {
  if (pluginName.includes('eslint-plugin-')) {
    return pluginName;
  }
  if (!pluginName.startsWith('@')) {
    return `eslint-plugin-${pluginName}`;
  }
  if (!pluginName.includes('/')) {
    return `${pluginName}/eslint-plugin`;
  }
  const [scope, name] = pluginName.split('/');
  return `${scope}/eslint-plugin-${name}`;
}
