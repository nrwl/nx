import { Tree, names, readJson } from '@nx/devkit';
import { join } from 'path';
import { ESLint } from 'eslint';
import * as ts from 'typescript';
import { generateAst } from './generate-ast';

/**
 * Converts an ESLint JSON config to a flat config.
 * Deletes the original file along with .eslintignore if it exists.
 */
export function convertEslintJsonToFlatConfig(
  tree: Tree,
  root: string,
  config: ESLint.ConfigData,
  sourceFile: string,
  destinationFile: string
) {
  const importsList: ts.VariableStatement[] = [];
  const exportElements: ts.Expression[] = [];

  if (config.extends) {
    addExtends(importsList, exportElements, config);
  }

  if (config.ignorePatterns) {
    const patterns = Array.isArray(config.ignorePatterns)
      ? config.ignorePatterns
      : [config.ignorePatterns];
    exportElements.push(generateAst({ ignores: patterns }, ts.factory));
  }

  if (tree.exists(`${root}/.eslintignore`)) {
    const patterns = tree
      .read(`${root}/.eslintignore`, 'utf-8')
      .split('\n')
      .filter((line) => line.length > 0);
    exportElements.push(generateAst({ ignores: patterns }, ts.factory));
  }

  if (config.plugins) {
    addPlugins(importsList, exportElements, config);
  }

  if (config.parser) {
    addParser(importsList, exportElements, config);
  }

  if (config.parserOptions) {
    exportElements.push(
      generateAst({ parserOptions: config.parserOptions }, ts.factory)
    );
  }

  if (config.rules) {
    exportElements.push(generateAst({ rules: config.rules }, ts.factory));
  }

  if (config.settings) {
    exportElements.push(generateAst({ settings: config.settings }, ts.factory));
  }

  if (config.env) {
    exportElements.push(generateAst({ env: config.env }, ts.factory));
  }

  if (config.globals) {
    exportElements.push(generateAst({ globals: config.globals }, ts.factory));
  }

  if (config.overrides) {
    config.overrides.forEach((override) => {
      exportElements.push(generateAst(override, ts.factory));
    });
  }

  tree.delete(join(root, sourceFile));
  tree.delete(join(root, '.eslintignore'));

  // create the node list and print it to new file
  const nodeList = createNodeList(importsList, exportElements);
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
}

// add parsed extends to export blocks and add import statements
function addExtends(importsList, configBlocks, config: ESLint.ConfigData) {
  const extendsConfig = Array.isArray(config.extends)
    ? config.extends
    : [config.extends];

  // add base extends
  extendsConfig
    .filter((imp) => imp.match(/^\.?(\.\/)/))
    .forEach((imp, index) => {
      const localName = index ? `baseConfig${index}` : 'baseConfig';

      const importStatement = ts.factory.createVariableStatement(
        undefined,
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              localName,
              undefined,
              undefined,
              ts.factory.createCallExpression(
                ts.factory.createIdentifier('require'),
                undefined,
                [ts.factory.createStringLiteral(imp)]
              )
            ),
          ],
          ts.NodeFlags.Const
        )
      );

      importsList.push(importStatement);
      configBlocks.push(
        ts.factory.createSpreadElement(ts.factory.createIdentifier(localName))
      );
    });
  // add plugin extends
  // TODO(meeroslav): Check if this is the recommended way of doing it
  const pluginExtends = extendsConfig.filter((imp) => !imp.match(/^\.?(\.\/)/));
  if (pluginExtends.length) {
    const pluginExtendsSpread = ts.factory.createSpreadElement(
      ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier('eslintrc'),
          ts.factory.createIdentifier('extends')
        ),
        undefined,
        []
      )
    );
    configBlocks.push(pluginExtendsSpread);
  }
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

function addPlugins(importsList, configBlocks, config: ESLint.ConfigData) {
  const mappedPlugins: { name: string; varName: string; imp: string }[] = [];
  config.plugins.forEach((name) => {
    const imp = getPluginImport(name);
    const varName = names(imp).propertyName;
    mappedPlugins.push({ name, varName, imp });
  });
  mappedPlugins.forEach(({ varName, imp }) => {
    const importStatement = ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            varName,
            undefined,
            undefined,
            ts.factory.createCallExpression(
              ts.factory.createIdentifier('require'),
              undefined,
              [ts.factory.createStringLiteral(imp)]
            )
          ),
        ],
        ts.NodeFlags.Const
      )
    );
    importsList.push(importStatement);
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
          true
        )
      ),
    ],
    false
  );
  configBlocks.push(pluginsAst);
}

function addParser(importsList, configBlocks, config: ESLint.ConfigData) {
  // TODO we need to find import for each plugin
  const imp = config.parser;
  const parserName = names(
    imp.replace(/^@/, '').split('/').join('-')
  ).propertyName;

  const importStatement = ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          parserName,
          undefined,
          undefined,
          ts.factory.createCallExpression(
            ts.factory.createIdentifier('require'),
            undefined,
            [ts.factory.createStringLiteral(imp)]
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  );

  importsList.push(importStatement);

  configBlocks.push(
    ts.factory.createObjectLiteralExpression(
      [
        ts.factory.createPropertyAssignment(
          'languageOptions',
          ts.factory.createObjectLiteralExpression(
            [
              ts.factory.createPropertyAssignment(
                'parser',
                ts.factory.createIdentifier(parserName)
              ),
            ],
            true
          )
        ),
      ],
      true
    )
  );
}

const DEFAULT_FLAT_CONFIG = `const { FlatCompat } = require("@eslint/eslintrc");
const eslintrc = new FlatCompat({
    baseDirectory: __dirname
});
`;

function createNodeList(
  importsList: ts.VariableStatement[],
  exportElements: ts.Expression[]
): ts.NodeArray<
  ts.VariableStatement | ts.Identifier | ts.ExportAssignment | ts.SourceFile
> {
  return ts.factory.createNodeArray([
    // add plugin imports
    ...importsList,
    ts.createSourceFile(
      '',
      DEFAULT_FLAT_CONFIG,
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.JS
    ),
    // creates:
    // export default [ ... ];
    ts.factory.createExportAssignment(
      undefined,
      false,
      ts.factory.createArrayLiteralExpression(exportElements, true)
    ),
  ]);
}
