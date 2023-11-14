import {
  Tree,
  addDependenciesToPackageJson,
  names,
  readJson,
} from '@nx/devkit';
import { join } from 'path';
import { ESLint } from 'eslint';
import * as ts from 'typescript';
import { eslintVersion, eslintrcVersion } from '../../../utils/versions';
import {
  createNodeList,
  generateAst,
  generateFlatOverride,
  generatePluginExtendsElement,
  generateSpreadElement,
  mapFilePath,
  stringifyNodeList,
} from '../../utils/flat-config/ast-utils';
import { getPluginImport } from '../../utils/eslint-file';

/**
 * Converts an ESLint JSON config to a flat config.
 * Deletes the original file along with .eslintignore if it exists.
 */
export function convertEslintJsonToFlatConfig(
  tree: Tree,
  root: string,
  sourceFile: string,
  destinationFile: string,
  ignorePaths: string[]
) {
  const importsMap = new Map<string, string>();
  const exportElements: ts.Expression[] = [];
  let isFlatCompatNeeded = false;
  let combinedConfig: ts.PropertyAssignment[] = [];
  let languageOptions: ts.PropertyAssignment[] = [];

  // read original config
  const config: ESLint.ConfigData = readJson(tree, `${root}/${sourceFile}`);

  if (config.extends) {
    isFlatCompatNeeded = addExtends(importsMap, exportElements, config, tree);
  }

  if (config.plugins) {
    addPlugins(importsMap, exportElements, config);
  }

  if (config.parser) {
    const imp = config.parser;
    const parserName = names(imp).propertyName;
    importsMap.set(imp, parserName);

    languageOptions.push(
      ts.factory.createPropertyAssignment(
        'parser',
        ts.factory.createIdentifier(parserName)
      )
    );
  }

  if (config.parserOptions) {
    languageOptions.push(
      ts.factory.createPropertyAssignment(
        'parserOptions',
        generateAst(config.parserOptions)
      )
    );
  }

  if (config.globals || config.env) {
    if (config.env) {
      importsMap.set('globals', 'globals');
    }

    languageOptions.push(
      ts.factory.createPropertyAssignment(
        'globals',
        ts.factory.createObjectLiteralExpression([
          ...Object.keys(config.env || {}).map((env) =>
            ts.factory.createSpreadAssignment(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier('globals'),
                ts.factory.createIdentifier(env)
              )
            )
          ),
          ...Object.keys(config.globals || {}).map((key) =>
            ts.factory.createPropertyAssignment(
              key,
              generateAst(config.globals[key])
            )
          ),
        ])
      )
    );
  }

  if (config.settings) {
    combinedConfig.push(
      ts.factory.createPropertyAssignment(
        'settings',
        generateAst(config.settings)
      )
    );
  }

  if (
    config.noInlineConfig !== undefined ||
    config.reportUnusedDisableDirectives !== undefined
  ) {
    combinedConfig.push(
      ts.factory.createPropertyAssignment(
        'linterOptions',
        generateAst({
          noInlineConfig: config.noInlineConfig,
          reportUnusedDisableDirectives: config.reportUnusedDisableDirectives,
        })
      )
    );
  }

  if (languageOptions.length > 0) {
    combinedConfig.push(
      ts.factory.createPropertyAssignment(
        'languageOptions',
        ts.factory.createObjectLiteralExpression(
          languageOptions,
          languageOptions.length > 1
        )
      )
    );
  }

  if (combinedConfig.length > 0) {
    exportElements.push(
      ts.factory.createObjectLiteralExpression(
        combinedConfig,
        combinedConfig.length > 1
      )
    );
  }

  if (config.rules) {
    exportElements.push(generateAst({ rules: config.rules }));
  }

  if (config.overrides) {
    config.overrides.forEach((override) => {
      if (
        override.env ||
        override.extends ||
        override.plugins ||
        override.parser
      ) {
        isFlatCompatNeeded = true;
      }
      exportElements.push(generateFlatOverride(override, root));
    });
  }

  if (config.ignorePatterns) {
    const patterns = (
      Array.isArray(config.ignorePatterns)
        ? config.ignorePatterns
        : [config.ignorePatterns]
    ).filter((pattern) => !['**/*', '!**/*', 'node_modules'].includes(pattern)); // these are useless in a flat config
    if (patterns.length > 0) {
      exportElements.push(
        generateAst({
          ignores: patterns.map((path) => mapFilePath(path, root)),
        })
      );
    }
  }

  for (const ignorePath of ignorePaths) {
    if (tree.exists(ignorePath)) {
      const patterns = tree
        .read(ignorePath, 'utf-8')
        .split('\n')
        .filter((line) => line.length > 0 && line !== 'node_modules')
        .map((path) => mapFilePath(path, root));
      if (patterns.length > 0) {
        exportElements.push(generateAst({ ignores: patterns }));
      }
    }
  }

  tree.delete(join(root, sourceFile));

  // create the node list and print it to new file
  const nodeList = createNodeList(
    importsMap,
    exportElements,
    isFlatCompatNeeded
  );
  const content = stringifyNodeList(nodeList, root, destinationFile);
  tree.write(join(root, destinationFile), content);

  if (isFlatCompatNeeded) {
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@eslint/eslintrc': eslintrcVersion,
      }
    );
  }
}

// add parsed extends to export blocks and add import statements
function addExtends(
  importsMap: Map<string, string | string[]>,
  configBlocks: ts.Expression[],
  config: ESLint.ConfigData,
  tree: Tree
): boolean {
  let isFlatCompatNeeded = false;
  const extendsConfig = Array.isArray(config.extends)
    ? config.extends
    : [config.extends];

  const eslintrcConfigs = [];

  // add base extends
  extendsConfig
    .filter((imp) => imp.match(/^\.?(\.\/)/))
    .forEach((imp, index) => {
      if (imp.match(/\.eslintrc(.base)?\.json$/)) {
        const localName = index ? `baseConfig${index}` : 'baseConfig';
        configBlocks.push(generateSpreadElement(localName));
        const newImport = imp.replace(
          /^(.*)\.eslintrc(.base)?\.json$/,
          '$1eslint$2.config.js'
        );
        importsMap.set(newImport, localName);
      } else {
        eslintrcConfigs.push(imp);
      }
    });
  // add plugin extends
  const pluginExtends = extendsConfig.filter((imp) => !imp.match(/^\.?(\.\/)/));
  if (pluginExtends.length) {
    const eslintPluginExtends = pluginExtends.filter((imp) =>
      imp.startsWith('eslint:')
    );
    pluginExtends.forEach((imp) => {
      if (!imp.startsWith('eslint:')) {
        eslintrcConfigs.push(imp);
      }
    });

    if (eslintPluginExtends.length) {
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@eslint/js': eslintVersion,
        }
      );

      importsMap.set('@eslint/js', 'js');
      eslintPluginExtends.forEach((plugin) => {
        configBlocks.push(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier('js'),
              ts.factory.createIdentifier('configs')
            ),
            ts.factory.createIdentifier(plugin.slice(7)) // strip 'eslint:' prefix
          )
        );
      });
    }
  }
  if (eslintrcConfigs.length) {
    isFlatCompatNeeded = true;
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@eslint/js': eslintVersion,
      }
    );

    configBlocks.push(generatePluginExtendsElement(eslintrcConfigs));
  }

  return isFlatCompatNeeded;
}

function addPlugins(
  importsMap: Map<string, string | string[]>,
  configBlocks: ts.Expression[],
  config: ESLint.ConfigData
) {
  const mappedPlugins: { name: string; varName: string; imp: string }[] = [];
  config.plugins.forEach((name) => {
    const imp = getPluginImport(name);
    const varName = names(imp).propertyName;
    mappedPlugins.push({ name, varName, imp });
  });
  mappedPlugins.forEach(({ varName, imp }) => {
    importsMap.set(imp, varName);
  });
  const pluginsAst = ts.factory.createObjectLiteralExpression(
    [
      ts.factory.createPropertyAssignment(
        'plugins',
        ts.factory.createObjectLiteralExpression(
          mappedPlugins.map(({ name, varName }) => {
            return ts.factory.createPropertyAssignment(
              ts.factory.createStringLiteral(name),
              ts.factory.createIdentifier(varName)
            );
          }),
          mappedPlugins.length > 1
        )
      ),
      ...(config.processor
        ? [
            ts.factory.createPropertyAssignment(
              'processor',
              ts.factory.createStringLiteral(config.processor)
            ),
          ]
        : []),
    ],
    false
  );
  configBlocks.push(pluginsAst);
}
