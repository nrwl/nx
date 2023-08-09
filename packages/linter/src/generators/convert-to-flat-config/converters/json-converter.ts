import {
  Tree,
  addDependenciesToPackageJson,
  names,
  readJson,
} from '@nx/devkit';
import { join } from 'path';
import { ESLint, Linter } from 'eslint';
import * as ts from 'typescript';
import { eslintrcVersion } from '../../../utils/versions';
import { generateAst, generateFlatOverride, generatePluginExtendsElement, generateRequire, generateSpreadElement, mapFilePath } from '../../utils/flat-config/ast-utils';

/**
 * Converts an ESLint JSON config to a flat config.
 * Deletes the original file along with .eslintignore if it exists.
 */
export function convertEslintJsonToFlatConfig(
  tree: Tree,
  root: string,
  sourceFile: string,
  destinationFile: string
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
    languageOptions.push(addParser(importsMap, config));
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

  if (tree.exists(`${root}/.eslintignore`)) {
    const patterns = tree
      .read(`${root}/.eslintignore`, 'utf-8')
      .split('\n')
      .filter((line) => line.length > 0 && line !== 'node_modules')
      .map((path) => mapFilePath(path, root));
    if (patterns.length > 0) {
      exportElements.push(generateAst({ ignores: patterns }));
    }
  }

  tree.delete(join(root, sourceFile));
  tree.delete(join(root, '.eslintignore'));

  // create the node list and print it to new file
  const nodeList = createNodeList(
    importsMap,
    exportElements,
    isFlatCompatNeeded
  );
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const resultFile = ts.createSourceFile(
    join(root, destinationFile),
    '',
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const result = printer.printList(
    ts.ListFormat.MultiLine,
    nodeList,
    resultFile
  );
  tree.write(join(root, destinationFile), result);

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

function updateFiles(
  override: Linter.ConfigOverride<Linter.RulesRecord>,
  root: string
) {
  if (override.files) {
    override.files = Array.isArray(override.files)
      ? override.files
      : [override.files];
    override.files = override.files.map((file) => mapFilePath(file, root));
  }
  return override;
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
        configBlocks.push(
          generateSpreadElement(localName)
        );
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
          '@eslint/js': eslintrcVersion,
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
        '@eslint/js': eslintrcVersion,
      }
    );

    configBlocks.push(generatePluginExtendsElement(eslintrcConfigs));
  }

  return isFlatCompatNeeded;
}

function getPluginImport(pluginName: string): string {
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

function addParser(
  importsMap: Map<string, string>,
  config: ESLint.ConfigData
): ts.PropertyAssignment {
  const imp = config.parser;
  const parserName = names(imp).propertyName;
  importsMap.set(imp, parserName);

  return ts.factory.createPropertyAssignment(
    'parser',
    ts.factory.createIdentifier(parserName)
  );
}

const DEFAULT_FLAT_CONFIG = `
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});
`;

function createNodeList(
  importsMap: Map<string, string>,
  exportElements: ts.Expression[],
  isFlatCompatNeeded: boolean
): ts.NodeArray<
  ts.VariableStatement | ts.Identifier | ts.ExpressionStatement | ts.SourceFile
> {
  const importsList = [];
  if (isFlatCompatNeeded) {
    importsMap.set('@eslint/js', 'js');

    importsList.push(
      generateRequire(
        ts.factory.createObjectBindingPattern([
          ts.factory.createBindingElement(undefined, undefined, 'FlatCompat'),
        ]),
        '@eslint/eslintrc'
      )
    );
  }

  // generateRequire(varName, imp, ts.factory);
  Array.from(importsMap.entries()).forEach(([imp, varName]) => {
    importsList.push(generateRequire(varName, imp));
  });

  return ts.factory.createNodeArray([
    // add plugin imports
    ...importsList,
    ts.createSourceFile(
      '',
      isFlatCompatNeeded ? DEFAULT_FLAT_CONFIG : '',
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.JS
    ),
    // creates:
    // module.exports = [ ... ];
    ts.factory.createExpressionStatement(
      ts.factory.createBinaryExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier('module'),
          ts.factory.createIdentifier('exports')
        ),
        ts.factory.createToken(ts.SyntaxKind.EqualsToken),
        ts.factory.createArrayLiteralExpression(exportElements, true)
      )
    ),
  ]);
}
