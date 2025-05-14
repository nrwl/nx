import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  joinPathFragments,
  names,
  offsetFromRoot,
  readJson,
  type Tree,
  updateJson,
} from '@nx/devkit';
import type { Linter } from 'eslint';
import { gte } from 'semver';
import {
  baseEsLintConfigFile,
  ESLINT_CONFIG_FILENAMES,
  BASE_ESLINT_CONFIG_FILENAMES,
  ESLINT_FLAT_CONFIG_FILENAMES,
} from '../../utils/config-file';
import {
  eslintFlatConfigFilenames,
  useFlatConfig,
} from '../../utils/flat-config';
import { getInstalledEslintVersion } from '../../utils/version-utils';
import {
  eslint9__eslintVersion,
  eslintCompat,
  eslintrcVersion,
} from '../../utils/versions';
import {
  addBlockToFlatConfigExport,
  addFlatCompatToFlatConfig,
  addImportToFlatConfig,
  addPatternsToFlatConfigIgnoresBlock,
  addPluginsToExportsBlock,
  generateAst,
  generateFlatOverride,
  generateFlatPredefinedConfig,
  generatePluginExtendsElement,
  generatePluginExtendsElementWithCompatFixup,
  hasFlatConfigIgnoresBlock,
  hasOverride,
  overrideNeedsCompat,
  removeOverridesFromLintConfig,
  replaceOverride,
} from './flat-config/ast-utils';
import { mapFilePath } from './flat-config/path-utils';
import ts = require('typescript');
import { dirname } from 'node:path/posix';

export function findEslintFile(
  tree: Tree,
  projectRoot?: string
): string | null {
  if (projectRoot === undefined) {
    for (const file of [
      baseEsLintConfigFile,
      ...BASE_ESLINT_CONFIG_FILENAMES,
    ]) {
      if (tree.exists(file)) {
        return file;
      }
    }
  }
  projectRoot ??= '';
  for (const file of ESLINT_CONFIG_FILENAMES) {
    if (tree.exists(joinPathFragments(projectRoot, file))) {
      return file;
    }
  }

  return null;
}

export function isEslintConfigSupported(tree: Tree, projectRoot = ''): boolean {
  const eslintFile = findEslintFile(tree, projectRoot);
  if (!eslintFile) {
    return false;
  }
  return (
    eslintFile.endsWith('.json') ||
    eslintFile.endsWith('.config.js') ||
    eslintFile.endsWith('.config.cjs') ||
    eslintFile.endsWith('.config.mjs')
  );
}

export function updateRelativePathsInConfig(
  tree: Tree,
  sourcePath: string,
  destinationPath: string
) {
  if (
    sourcePath === destinationPath ||
    !isEslintConfigSupported(tree, destinationPath)
  ) {
    return;
  }

  const configPath = joinPathFragments(
    destinationPath,
    findEslintFile(tree, destinationPath)
  );
  const offset = offsetFromRoot(destinationPath);

  if (useFlatConfig(tree)) {
    const config = tree.read(configPath, 'utf-8');
    tree.write(
      configPath,
      replaceFlatConfigPaths(config, sourcePath, offset, destinationPath, tree)
    );
  } else {
    updateJson(tree, configPath, (json) => {
      if (typeof json.extends === 'string') {
        json.extends = offsetFilePath(sourcePath, json.extends, offset, tree);
      } else if (json.extends) {
        json.extends = json.extends.map((extend: string) =>
          offsetFilePath(sourcePath, extend, offset, tree)
        );
      }

      json.overrides?.forEach(
        (o: { parserOptions?: { project?: string | string[] } }) => {
          if (o.parserOptions?.project) {
            o.parserOptions.project = Array.isArray(o.parserOptions.project)
              ? o.parserOptions.project.map((p) =>
                  p.replace(sourcePath, destinationPath)
                )
              : o.parserOptions.project.replace(sourcePath, destinationPath);
          }
        }
      );
      return json;
    });
  }
}

function replaceFlatConfigPaths(
  config: string,
  sourceRoot: string,
  offset: string,
  destinationRoot: string,
  tree: Tree
): string {
  let match;
  let newConfig = config;

  // replace requires
  const requireRegex = RegExp(/require\(['"](.*)['"]\)/g);
  while ((match = requireRegex.exec(newConfig)) !== null) {
    const newPath = offsetFilePath(sourceRoot, match[1], offset, tree);
    newConfig =
      newConfig.slice(0, match.index) +
      `require('${newPath}')` +
      newConfig.slice(match.index + match[0].length);
  }

  // Handle import statements
  const importRegex = RegExp(/import\s+.*?\s+from\s+['"](.*)['"]/g);
  while ((match = importRegex.exec(newConfig)) !== null) {
    const oldPath = match[1];
    const newPath = offsetFilePath(sourceRoot, oldPath, offset, tree);

    // Replace the old path with the updated path
    newConfig =
      newConfig.slice(0, match.index + match[0].indexOf(oldPath)) +
      newPath +
      newConfig.slice(match.index + match[0].indexOf(oldPath) + oldPath.length);
  }
  // replace projects
  const projectRegex = RegExp(/project:\s?\[?['"](.*)['"]\]?/g);
  while ((match = projectRegex.exec(newConfig)) !== null) {
    const newProjectDef = match[0].replaceAll(sourceRoot, destinationRoot);
    newConfig =
      newConfig.slice(0, match.index) +
      newProjectDef +
      newConfig.slice(match.index + match[0].length);
  }
  return newConfig;
}

function offsetFilePath(
  projectRoot: string,
  pathToFile: string,
  offset: string,
  tree: Tree
): string {
  if (
    ESLINT_CONFIG_FILENAMES.some((eslintFile) =>
      pathToFile.includes(eslintFile)
    )
  ) {
    // if the file is point to base eslint
    const rootEslint = findEslintFile(tree);
    if (rootEslint) {
      return joinPathFragments(offset, rootEslint);
    }
  }
  if (!pathToFile.startsWith('..')) {
    // not a relative path
    return pathToFile;
  }
  return joinPathFragments(offset, projectRoot, pathToFile);
}

export function determineEslintConfigFormat(content: string): 'mjs' | 'cjs' {
  const sourceFile = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true
  );

  // Check if there's an `export default` in the AST
  const hasExportDefault = sourceFile.statements.some(
    (statement) => ts.isExportAssignment(statement) && !statement.isExportEquals
  );

  return hasExportDefault ? 'mjs' : 'cjs';
}

export function addOverrideToLintConfig(
  tree: Tree,
  root: string,
  override: Partial<Linter.ConfigOverride<Linter.RulesRecord>>,
  options: { insertAtTheEnd?: boolean; checkBaseConfig?: boolean } = {
    insertAtTheEnd: true,
  }
) {
  const isBase =
    options.checkBaseConfig && findEslintFile(tree, root).includes('.base');
  if (useFlatConfig(tree)) {
    let fileName: string;
    if (isBase) {
      for (const file of BASE_ESLINT_CONFIG_FILENAMES) {
        if (tree.exists(joinPathFragments(root, file))) {
          fileName = joinPathFragments(root, file);
          break;
        }
      }
    } else {
      for (const f of eslintFlatConfigFilenames) {
        if (tree.exists(joinPathFragments(root, f))) {
          fileName = joinPathFragments(root, f);
          break;
        }
      }
    }

    let content = tree.read(fileName, 'utf8');
    const format = content.includes('export default') ? 'mjs' : 'cjs';

    const flatOverride = generateFlatOverride(override, format);
    // Check if the provided override using legacy eslintrc properties or plugins, if so we need to add compat
    if (overrideNeedsCompat(override)) {
      content = addFlatCompatToFlatConfig(content);
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
      json.overrides ??= [];
      if (options.insertAtTheEnd) {
        json.overrides.push(override);
      } else {
        json.overrides.unshift(override);
      }
      return json;
    });
  }
}

export function updateOverrideInLintConfig(
  tree: Tree,
  rootOrFile: string,
  lookup: (override: Linter.ConfigOverride<Linter.RulesRecord>) => boolean,
  update: (
    override: Linter.ConfigOverride<Linter.RulesRecord>
  ) => Linter.ConfigOverride<Linter.RulesRecord>
) {
  let fileName: string;
  let root = rootOrFile;
  if (tree.exists(rootOrFile) && tree.isFile(rootOrFile)) {
    fileName = rootOrFile;
    root = dirname(rootOrFile);
  }

  if (useFlatConfig(tree)) {
    if (!fileName) {
      for (const f of eslintFlatConfigFilenames) {
        if (tree.exists(joinPathFragments(root, f))) {
          fileName = joinPathFragments(root, f);
          break;
        }
      }
    }

    let content = tree.read(fileName, 'utf8');
    content = replaceOverride(content, root, lookup, update);
    tree.write(fileName, content);
  } else {
    fileName ??= joinPathFragments(root, '.eslintrc.json');
    if (!tree.exists(fileName)) {
      return;
    }
    const existingJson = readJson(tree, fileName);
    if (!existingJson.overrides || !existingJson.overrides.some(lookup)) {
      return;
    }
    updateJson(tree, fileName, (json: Linter.Config) => {
      const index = json.overrides.findIndex(lookup);
      if (index !== -1) {
        const newOverride = update(json.overrides[index]);
        if (newOverride) {
          json.overrides[index] = newOverride;
        } else {
          json.overrides.splice(index, 1);
        }
      }
      return json;
    });
  }
}

export function lintConfigHasOverride(
  tree: Tree,
  rootOrFile: string,
  lookup: (override: Linter.ConfigOverride<Linter.RulesRecord>) => boolean,
  checkBaseConfig = false
): boolean {
  let fileName: string;
  let root = rootOrFile;
  if (tree.exists(rootOrFile) && tree.isFile(rootOrFile)) {
    fileName = rootOrFile;
    root = dirname(rootOrFile);
  }
  if (!fileName && !isEslintConfigSupported(tree, root)) {
    return false;
  }
  const isBase =
    !fileName &&
    checkBaseConfig &&
    findEslintFile(tree, root).includes('.base');
  if (isBase) {
    for (const file of BASE_ESLINT_CONFIG_FILENAMES) {
      if (tree.exists(joinPathFragments(root, file))) {
        fileName = joinPathFragments(root, file);
        break;
      }
    }
  }
  if (useFlatConfig(tree)) {
    if (!fileName) {
      for (const f of eslintFlatConfigFilenames) {
        if (tree.exists(joinPathFragments(root, f))) {
          fileName = joinPathFragments(root, f);
          break;
        }
      }
    }
    const content = tree.read(fileName, 'utf8');
    return hasOverride(content, lookup);
  } else {
    fileName ??= joinPathFragments(
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
    let fileName: string;
    for (const f of eslintFlatConfigFilenames) {
      if (tree.exists(joinPathFragments(root, f))) {
        fileName = joinPathFragments(root, f);
        break;
      }
    }
    let content = tree.read(fileName, 'utf8');
    const format = content.includes('export default') ? 'mjs' : 'cjs';
    // Check if any of the provided overrides using legacy eslintrc properties or plugins, if so we need to add compat
    if (overrides.some(overrideNeedsCompat)) {
      content = addFlatCompatToFlatConfig(content);
    }
    content = removeOverridesFromLintConfig(content);
    overrides.forEach((override) => {
      const flatOverride = generateFlatOverride(override, format);
      content = addBlockToFlatConfigExport(content, flatOverride);
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
  plugin:
    | string
    | { name: string; needCompatFixup: boolean }
    | Array<string | { name: string; needCompatFixup: boolean }>,
  insertAtTheEnd = false
): GeneratorCallback {
  if (useFlatConfig(tree)) {
    const pluginExtends: ts.SpreadElement[] = [];
    let fileName: string;
    for (const f of eslintFlatConfigFilenames) {
      if (tree.exists(joinPathFragments(root, f))) {
        fileName = joinPathFragments(root, f);
        break;
      }
    }
    // Check the file extension to determine the format of the config if it is .js we look for the export
    const eslintConfigFormat = fileName.endsWith('.mjs')
      ? 'mjs'
      : fileName.endsWith('.cjs')
      ? 'cjs'
      : tree.read(fileName, 'utf-8').includes('module.exports')
      ? 'cjs'
      : 'mjs';

    let shouldImportEslintCompat = false;
    // assume eslint version is 9 if not found, as it's what we'd be generating by default
    const eslintVersion =
      getInstalledEslintVersion(tree) ?? eslint9__eslintVersion;
    if (gte(eslintVersion, '9.0.0')) {
      // eslint v9 requires the incompatible plugins to be wrapped with a helper from @eslint/compat
      const plugins = (Array.isArray(plugin) ? plugin : [plugin]).map((p) =>
        typeof p === 'string' ? { name: p, needCompatFixup: false } : p
      );
      let compatiblePluginsBatch: string[] = [];
      plugins.forEach(({ name, needCompatFixup }) => {
        if (needCompatFixup) {
          if (compatiblePluginsBatch.length > 0) {
            // flush the current batch of compatible plugins and reset it
            pluginExtends.push(
              generatePluginExtendsElement(compatiblePluginsBatch)
            );
            compatiblePluginsBatch = [];
          }
          // generate the extends for the incompatible plugin
          pluginExtends.push(generatePluginExtendsElementWithCompatFixup(name));
          shouldImportEslintCompat = true;
        } else {
          // add the compatible plugin to the current batch
          compatiblePluginsBatch.push(name);
        }
      });

      if (compatiblePluginsBatch.length > 0) {
        // flush the batch of compatible plugins
        pluginExtends.push(
          generatePluginExtendsElement(compatiblePluginsBatch)
        );
      }
    } else {
      const plugins = (Array.isArray(plugin) ? plugin : [plugin]).map((p) =>
        typeof p === 'string' ? p : p.name
      );
      pluginExtends.push(generatePluginExtendsElement(plugins));
    }

    let content = tree.read(fileName, 'utf8');
    if (shouldImportEslintCompat) {
      content = addImportToFlatConfig(
        content,
        ['fixupConfigRules'],
        '@eslint/compat'
      );
    }
    content = addFlatCompatToFlatConfig(content);
    // reverse the order to ensure they are added in the correct order at the
    // start of the `extends` array
    for (const pluginExtend of pluginExtends.reverse()) {
      content = addBlockToFlatConfigExport(content, pluginExtend, {
        insertAtTheEnd,
      });
    }
    tree.write(fileName, content);

    if (shouldImportEslintCompat) {
      return addDependenciesToPackageJson(
        tree,
        {},
        { '@eslint/compat': eslintCompat, '@eslint/eslintrc': eslintrcVersion },
        undefined,
        true
      );
    }

    return addDependenciesToPackageJson(
      tree,
      {},
      { '@eslint/eslintrc': eslintrcVersion },
      undefined,
      true
    );
  } else {
    const plugins = (Array.isArray(plugin) ? plugin : [plugin]).map((p) =>
      typeof p === 'string' ? p : p.name
    );
    const fileName = joinPathFragments(root, '.eslintrc.json');
    updateJson(tree, fileName, (json) => {
      json.extends ??= [];
      json.extends = [
        ...plugins,
        ...(Array.isArray(json.extends) ? json.extends : [json.extends]),
      ];
      return json;
    });

    return () => {};
  }
}

export function addPredefinedConfigToFlatLintConfig(
  tree: Tree,
  root: string,
  predefinedConfigName: string,
  moduleName = 'nx',
  moduleImportPath = '@nx/eslint-plugin',
  spread = true,
  insertAtTheEnd = true
): void {
  if (!useFlatConfig(tree))
    throw new Error('Predefined configs can only be used with flat configs');

  let fileName: string;
  for (const f of eslintFlatConfigFilenames) {
    if (tree.exists(joinPathFragments(root, f))) {
      fileName = joinPathFragments(root, f);
      break;
    }
  }

  let content = tree.read(fileName, 'utf8');
  content = addImportToFlatConfig(content, moduleName, moduleImportPath);
  content = addBlockToFlatConfigExport(
    content,
    generateFlatPredefinedConfig(predefinedConfigName, moduleName, spread),
    { insertAtTheEnd }
  );

  tree.write(fileName, content);
}

export function addPluginsToLintConfig(
  tree: Tree,
  root: string,
  plugin: string | string[]
) {
  const plugins = Array.isArray(plugin) ? plugin : [plugin];
  if (useFlatConfig(tree)) {
    let fileName: string;
    for (const f of eslintFlatConfigFilenames) {
      if (tree.exists(joinPathFragments(root, f))) {
        fileName = joinPathFragments(root, f);
        break;
      }
    }

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
    let fileName: string;
    for (const f of eslintFlatConfigFilenames) {
      if (tree.exists(joinPathFragments(root, f))) {
        fileName = joinPathFragments(root, f);
        break;
      }
    }

    if (!fileName) {
      return;
    }

    let content = tree.read(fileName, 'utf8');
    if (hasFlatConfigIgnoresBlock(content)) {
      content = addPatternsToFlatConfigIgnoresBlock(content, ignorePatterns);
      tree.write(fileName, content);
    } else {
      const block = generateAst<ts.ObjectLiteralExpression>({
        ignores: ignorePatterns.map((path) => mapFilePath(path)),
      });
      tree.write(fileName, addBlockToFlatConfigExport(content, block));
    }
  } else {
    const fileName = joinPathFragments(root, '.eslintrc.json');
    if (!tree.exists(fileName)) {
      return;
    }
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
