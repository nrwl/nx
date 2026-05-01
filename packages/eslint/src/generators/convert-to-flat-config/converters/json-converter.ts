import { Tree, names } from '@nx/devkit';
import { ESLint } from 'eslint';
import * as ts from 'typescript';
import {
  addFlatCompatToFlatConfig,
  createNodeList,
  generateAst,
  generateFlatOverride,
  generateFlatPredefinedConfig,
  generatePluginExtendsElement,
  generateSpreadElement,
  stringifyNodeList,
} from '../../utils/flat-config/ast-utils';
import { getPluginImport } from '../../utils/eslint-file';
import { mapFilePath } from '../../utils/flat-config/path-utils';

/**
 * Converts an ESLint JSON config to a flat config.
 * Deletes the original file along with .eslintignore if it exists.
 */
export function convertEslintJsonToFlatConfig(
  tree: Tree,
  root: string,
  config: ESLint.ConfigData,
  ignorePaths: string[],
  format: 'cjs' | 'mjs'
): { content: string; addESLintRC: boolean; addESLintJS: boolean } {
  const importsMap = new Map<string, string>();
  const exportElements: ts.Expression[] = [];
  let isFlatCompatNeeded = false;
  let isESLintJSNeeded = false;
  let combinedConfig: ts.PropertyAssignment[] = [];
  let languageOptions: ts.PropertyAssignment[] = [];

  // exclude dist and eslint config from being linted, which matches the default for new workspaces
  exportElements.push(
    generateAst({
      ignores: ['**/dist', '**/out-tsc'],
    })
  );

  if (config.extends) {
    const extendsResult = addExtends(
      importsMap,
      exportElements,
      config,
      format
    );
    isFlatCompatNeeded = extendsResult.isFlatCompatNeeded;
    isESLintJSNeeded = extendsResult.isESLintJSNeeded;
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
      if (override.extends) {
        const extendsArr = Array.isArray(override.extends)
          ? override.extends
          : [override.extends];
        const mapped = extendsArr.map((e) => ({
          original: e,
          flatConfig: mapNxPluginToFlatConfig(e),
        }));
        const nxExtends = mapped.filter((m) => m.flatConfig);
        const nonNxExtends = mapped
          .filter((m) => !m.flatConfig)
          .map((m) => m.original);

        if (nxExtends.length > 0) {
          const nxVar = (importsMap.get('@nx/eslint-plugin') as string) ?? 'nx';
          importsMap.set('@nx/eslint-plugin', nxVar);
          nxExtends.forEach((ext) => {
            exportElements.push(
              generateFlatPredefinedConfig(ext.flatConfig, nxVar, true)
            );
          });

          // Build remaining override without Nx extends
          const remainingOverride = { ...override };
          if (nonNxExtends.length > 0) {
            remainingOverride.extends = nonNxExtends;
          } else {
            delete remainingOverride.extends;
          }

          // Emit remaining override if it has content beyond files and empty rules
          const {
            files: _files,
            rules: remainingRules,
            ...remainingRest
          } = remainingOverride;
          const hasNonEmptyRules =
            remainingRules && Object.keys(remainingRules).length > 0;
          if (Object.keys(remainingRest).length > 0 || hasNonEmptyRules) {
            if (
              remainingOverride.env ||
              remainingOverride.extends ||
              remainingOverride.plugins ||
              remainingOverride.parser
            ) {
              isFlatCompatNeeded = true;
            }
            exportElements.push(
              generateFlatOverride(remainingOverride, format)
            );
          }
          return;
        }
      }

      if (
        override.env ||
        override.extends ||
        override.plugins ||
        override.parser
      ) {
        isFlatCompatNeeded = true;
      }
      exportElements.push(generateFlatOverride(override, format));
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
          ignores: patterns.map((path) => mapFilePath(path)),
        })
      );
    }
  }

  for (const ignorePath of ignorePaths) {
    if (tree.exists(ignorePath)) {
      const patterns = tree
        .read(ignorePath, 'utf-8')
        .split(/\r\n|\r|\n/)
        .filter((line) => line.length > 0 && line !== 'node_modules')
        .map((path) => mapFilePath(path));
      if (patterns.length > 0) {
        exportElements.push(generateAst({ ignores: patterns }));
      }
    }
  }

  // create the node list and print it to new file
  const nodeList = createNodeList(importsMap, exportElements, format);
  let content = stringifyNodeList(nodeList);
  if (isFlatCompatNeeded) {
    content = addFlatCompatToFlatConfig(content);
  }

  return {
    content,
    addESLintRC: isFlatCompatNeeded,
    addESLintJS: isESLintJSNeeded,
  };
}

// add parsed extends to export blocks and add import statements
function addExtends(
  importsMap: Map<string, string | string[]>,
  configBlocks: ts.Expression[],
  config: ESLint.ConfigData,
  format: 'mjs' | 'cjs'
): { isFlatCompatNeeded: boolean; isESLintJSNeeded: boolean } {
  let isFlatCompatNeeded = false;
  let isESLintJSNeeded = false;
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
          `$1eslint$2.config.${format}`
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
      if (imp.startsWith('eslint:')) {
        return;
      }
      const nxFlatConfig = mapNxPluginToFlatConfig(imp);
      if (nxFlatConfig) {
        const nxVar = (importsMap.get('@nx/eslint-plugin') as string) ?? 'nx';
        importsMap.set('@nx/eslint-plugin', nxVar);
        configBlocks.push(
          generateFlatPredefinedConfig(nxFlatConfig, nxVar, true)
        );
      } else {
        eslintrcConfigs.push(imp);
      }
    });

    if (eslintPluginExtends.length) {
      isESLintJSNeeded = true;

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
    isESLintJSNeeded = true;

    configBlocks.push(generatePluginExtendsElement(eslintrcConfigs));
  }

  return { isFlatCompatNeeded, isESLintJSNeeded };
}

function addPlugins(
  importsMap: Map<string, string | string[]>,
  configBlocks: ts.Expression[],
  config: ESLint.ConfigData
) {
  // Replace @nx plugin with flat/base predefined config to match fresh generation.
  // flat/base registers the @nx plugin and ignores .nx directory.
  // This runs before overrides are processed, so we set the import name here
  // for Nx extends that may appear in overrides later.
  if (config.plugins.includes('@nx')) {
    importsMap.set('@nx/eslint-plugin', 'nx');
    configBlocks.push(generateFlatPredefinedConfig('flat/base', 'nx', true));
  }

  const remainingPlugins = config.plugins.filter((name) => name !== '@nx');
  if (remainingPlugins.length === 0) {
    return;
  }

  const mappedPlugins: { name: string; varName: string; imp: string }[] = [];
  remainingPlugins.forEach((name) => {
    const imp = getPluginImport(name);
    const varName = (importsMap.get(imp) as string) ?? names(imp).propertyName;
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

const nxPluginToFlatConfigMap: Record<string, string> = {
  'plugin:@nx/typescript': 'flat/typescript',
  'plugin:@nx/javascript': 'flat/javascript',
  'plugin:@nx/react': 'flat/react',
  'plugin:@nx/react-base': 'flat/react-base',
  'plugin:@nx/react-typescript': 'flat/react-typescript',
  'plugin:@nx/react-jsx': 'flat/react-jsx',
  'plugin:@nx/angular': 'flat/angular',
  'plugin:@nx/angular-template': 'flat/angular-template',
  'plugin:@nrwl/nx/typescript': 'flat/typescript',
  'plugin:@nrwl/nx/javascript': 'flat/javascript',
};

function mapNxPluginToFlatConfig(pluginExtend: string): string | undefined {
  return nxPluginToFlatConfigMap[pluginExtend];
}
