import { applyChangesToString, ChangeType, Tree } from '@nx/devkit';
import { findNodes } from '@nx/js';
import { TargetFlags } from './generator-utils';
import type {
  ArrayLiteralExpression,
  Node,
  PropertyAssignment,
  ReturnStatement,
} from 'typescript';

export function ensureViteConfigIsCorrect(
  tree: Tree,
  path: string,
  buildConfigString: string,
  buildConfigObject: {},
  imports: string[],
  plugins: string[],
  testConfigString: string,
  testConfigObject: {},
  cacheDir: string,
  projectAlreadyHasViteTargets?: TargetFlags,
  resolveTsconfigPaths?: boolean
): boolean {
  const fileContent = tree.read(path, 'utf-8');

  let updatedContent = undefined;

  if (!projectAlreadyHasViteTargets?.test && testConfigString?.length) {
    updatedContent = handleBuildOrTestNode(
      fileContent,
      testConfigString,
      testConfigObject,
      'test'
    );
  }

  if (!projectAlreadyHasViteTargets?.build && buildConfigString?.length) {
    updatedContent = handleBuildOrTestNode(
      updatedContent ?? fileContent,
      buildConfigString,
      buildConfigObject,
      'build'
    );
  }

  updatedContent =
    handlePluginNode(updatedContent ?? fileContent, imports, plugins) ??
    updatedContent;

  if (cacheDir?.length) {
    updatedContent = handleCacheDirNode(
      updatedContent ?? fileContent,
      cacheDir
    );
  }

  if (resolveTsconfigPaths) {
    updatedContent = addTsconfigPathsResolution(updatedContent ?? fileContent);
  }

  if (updatedContent) {
    tree.write(path, updatedContent);
    return true;
  } else {
    return false;
  }
}

function handleBuildOrTestNode(
  updatedFileContent: string,
  configContentString: string,
  configContentObject: {},
  name: 'build' | 'test'
): string | undefined {
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const buildOrTestNode = tsquery.query(
    updatedFileContent,
    `PropertyAssignment:has(Identifier[name="${name}"])`
  );

  if (buildOrTestNode.length) {
    return tsquery.replace(
      updatedFileContent,
      `PropertyAssignment:has(Identifier[name="${name}"])`,
      (node: PropertyAssignment) => {
        const existingProperties = tsquery.query(
          node.initializer,
          'PropertyAssignment'
        ) as PropertyAssignment[];
        let updatedPropsString = '';
        for (const prop of existingProperties) {
          const propName = prop.name.getText();
          if (
            !configContentObject[propName] &&
            propName !== 'dir' &&
            propName !== 'reportsDirectory' &&
            propName !== 'provider'
          ) {
            // NOTE: Watch for formatting.
            updatedPropsString += `    '${propName}': ${prop.initializer.getText()},\n`;
          }
        }
        for (const [propName, propValue] of Object.entries(
          configContentObject
        )) {
          // NOTE: Watch for formatting.
          if (propName === 'coverage') {
            let propString = `    '${propName}': {\n`;
            for (const [pName, pValue] of Object.entries(propValue)) {
              if (pName === 'provider') {
                propString += `    '${pName}': ${pValue} as const,\n`;
              } else {
                propString += `    '${pName}': '${pValue}',\n`;
              }
            }
            propString += `}`;
            updatedPropsString += `${propString}\n`;
          } else if (propName === 'lib') {
            let propString = `    '${propName}': {\n`;
            for (const [pName, pValue] of Object.entries(propValue)) {
              if (pName === 'formats') {
                propString += `      '${pName}': [${pValue
                  .map((format: string) => `'${format}' as const`)
                  .join(', ')}],\n`;
              } else {
                propString += `      '${pName}': ${JSON.stringify(pValue)},\n`;
              }
            }
            propString += `    },`;
            updatedPropsString += `${propString}\n`;
          } else {
            updatedPropsString += `    '${propName}': ${JSON.stringify(
              propValue
            )},\n`;
          }
        }
        return `${name}: {
${updatedPropsString}  }`;
      }
    );
  } else {
    const foundDefineConfig = tsquery.query(
      updatedFileContent,
      'CallExpression:has(Identifier[name="defineConfig"])'
    );

    if (foundDefineConfig.length) {
      const conditionalConfig = tsquery.query(
        foundDefineConfig[0],
        'ArrowFunction'
      );

      if (conditionalConfig.length) {
        if (name === 'build') {
          return transformConditionalConfig(
            conditionalConfig,
            updatedFileContent,
            configContentString
          );
        } else {
          // no test config in conditional config
          return updatedFileContent;
        }
      } else {
        const propertyAssignments = tsquery.query(
          foundDefineConfig[0],
          'PropertyAssignment'
        );

        if (propertyAssignments.length) {
          return applyChangesToString(updatedFileContent, [
            {
              type: ChangeType.Insert,
              index: propertyAssignments[0].getStart(),
              text: configContentString,
            },
          ]);
        } else {
          return applyChangesToString(updatedFileContent, [
            {
              type: ChangeType.Insert,
              index: foundDefineConfig[0].getStart() + 14,
              text: configContentString,
            },
          ]);
        }
      }
    } else {
      // build config does not exist and defineConfig is not used
      // could also potentially be invalid syntax, so try-catch
      try {
        const defaultExport = tsquery.query(
          updatedFileContent,
          'ExportAssignment'
        );
        const found = tsquery.query(
          defaultExport?.[0],
          'ObjectLiteralExpression'
        );
        const startOfObject = found?.[0].getStart();
        return applyChangesToString(updatedFileContent, [
          {
            type: ChangeType.Insert,
            index: startOfObject + 1,
            text: configContentString,
          },
        ]);
      } catch {
        return updatedFileContent;
      }
    }
  }
}

function transformCurrentBuildObject(
  index: number,
  returnStatements: ReturnStatement[],
  appFileContent: string,
  buildConfigObject: {}
): string | undefined {
  if (!returnStatements?.[index]) {
    return undefined;
  }
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const currentBuildObject = tsquery
    .query(returnStatements[index], 'ObjectLiteralExpression')?.[0]
    .getText();

  const currentBuildObjectStart = returnStatements[index].getStart();
  const currentBuildObjectEnd = returnStatements[index].getEnd();
  const newReturnObject = tsquery.replace(
    returnStatements[index].getText(),
    'ObjectLiteralExpression',
    (_node: Node) => {
      return `{
        ...${currentBuildObject},
        ...${JSON.stringify(buildConfigObject)}
      }`;
    }
  );

  const newContents = applyChangesToString(appFileContent, [
    {
      type: ChangeType.Delete,
      start: currentBuildObjectStart,
      length: currentBuildObjectEnd - currentBuildObjectStart,
    },
    {
      type: ChangeType.Insert,
      index: currentBuildObjectStart,
      text: newReturnObject,
    },
  ]);

  return newContents;
}

function transformConditionalConfig(
  conditionalConfig: Node[],
  appFileContent: string,
  buildConfigObject: {}
): string | undefined {
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const { SyntaxKind } = require('typescript');
  const functionBlock = tsquery.query(conditionalConfig[0], 'Block');
  const ifStatement = tsquery.query(functionBlock?.[0], 'IfStatement');

  const binaryExpressions = tsquery.query(ifStatement?.[0], 'BinaryExpression');

  const buildExists = binaryExpressions?.find(
    (binaryExpression) => binaryExpression.getText() === `command === 'build'`
  );

  const buildExistsExpressionIndex = binaryExpressions?.findIndex(
    (binaryExpression) => binaryExpression.getText() === `command === 'build'`
  );

  const serveExists = binaryExpressions?.find(
    (binaryExpression) => binaryExpression.getText() === `command === 'serve'`
  );

  const elseKeywordExists = findNodes(ifStatement?.[0], SyntaxKind.ElseKeyword);
  const returnStatements: ReturnStatement[] = tsquery.query(
    ifStatement[0],
    'ReturnStatement'
  );

  if (!buildExists) {
    if (serveExists && elseKeywordExists) {
      // build options live inside the else block
      return (
        transformCurrentBuildObject(
          returnStatements?.length - 1,
          returnStatements,
          appFileContent,
          buildConfigObject
        ) ?? appFileContent
      );
    } else {
      // no build options exist yet
      const functionBlockStart = functionBlock?.[0].getStart();
      const newContents = applyChangesToString(appFileContent, [
        {
          type: ChangeType.Insert,
          index: functionBlockStart + 1,
          text: `
            if (command === 'build') {
              return ${JSON.stringify(buildConfigObject)}
            }
            `,
        },
      ]);
      return newContents;
    }
  } else {
    // build already exists
    // it will be the return statement which lives
    // at the buildExistsExpressionIndex

    return (
      transformCurrentBuildObject(
        buildExistsExpressionIndex,
        returnStatements,
        appFileContent,
        buildConfigObject
      ) ?? appFileContent
    );
  }
}

function handlePluginNode(
  appFileContent: string,
  imports: string[],
  plugins: string[]
): string | undefined {
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const file = tsquery.ast(appFileContent);
  const pluginsNode = tsquery.query(
    file,
    'PropertyAssignment:has(Identifier[name="plugins"])'
  );

  let writeFile = false;

  if (pluginsNode.length) {
    appFileContent = tsquery.replace(
      file.getText(),
      'PropertyAssignment:has(Identifier[name="plugins"])',
      (node: Node) => {
        const found = tsquery.query(
          node,
          'ArrayLiteralExpression'
        ) as ArrayLiteralExpression[];
        let updatedPluginsString = '';

        const existingPluginNodes = found?.[0].elements ?? [];

        for (const plugin of existingPluginNodes) {
          updatedPluginsString += `${plugin.getText()}, `;
        }

        for (const plugin of plugins) {
          if (
            !existingPluginNodes?.some((node) =>
              node.getText().includes(plugin)
            )
          ) {
            updatedPluginsString += `${plugin}, `;
          }
        }

        return `plugins: [${updatedPluginsString}]`;
      }
    );
    writeFile = true;
  } else {
    // Plugins node does not exist yet
    // So make one from scratch

    const foundDefineConfig = tsquery.query(
      file,
      'CallExpression:has(Identifier[name="defineConfig"])'
    );

    if (foundDefineConfig.length) {
      const conditionalConfig = tsquery.query(
        foundDefineConfig[0],
        'ArrowFunction'
      );

      if (conditionalConfig.length) {
        // We are NOT transforming the conditional config
        // with plugins
        writeFile = false;
      } else {
        const propertyAssignments = tsquery.query(
          foundDefineConfig[0],
          'PropertyAssignment'
        );

        if (propertyAssignments.length) {
          appFileContent = applyChangesToString(appFileContent, [
            {
              type: ChangeType.Insert,
              index: propertyAssignments[0].getStart(),
              text: `plugins: [${plugins.join(', ')}],`,
            },
          ]);
          writeFile = true;
        } else {
          appFileContent = applyChangesToString(appFileContent, [
            {
              type: ChangeType.Insert,
              index: foundDefineConfig[0].getStart() + 14,
              text: `plugins: [${plugins.join(', ')}],`,
            },
          ]);
          writeFile = true;
        }
      }
    } else {
      // Plugins option does not exist and defineConfig is not used
      // could also potentially be invalid syntax, so try-catch
      try {
        const defaultExport = tsquery.query(file, 'ExportAssignment');
        const found = tsquery?.query(
          defaultExport?.[0],
          'ObjectLiteralExpression'
        );
        const startOfObject = found?.[0].getStart();
        appFileContent = applyChangesToString(appFileContent, [
          {
            type: ChangeType.Insert,
            index: startOfObject + 1,
            text: `plugins: [${plugins.join(', ')}],`,
          },
        ]);
        writeFile = true;
      } catch {
        writeFile = false;
      }
    }
  }
  if (writeFile) {
    const filteredImports = filterImport(appFileContent, imports);
    return filteredImports.join(';\n') + '\n' + appFileContent;
  }
}

function filterImport(appFileContent: string, imports: string[]): string[] {
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const file = tsquery.ast(appFileContent);
  const importNodes = tsquery.query(
    file,
    ':matches(ImportDeclaration, VariableStatement)'
  );

  const importsArrayExisting = importNodes?.map((node) => {
    return node.getText().slice(0, -1);
  });

  return imports.filter((importString) => {
    return !importsArrayExisting?.includes(importString);
  });
}

/**
 * Enables Vite's native `resolve.tsconfigPaths`, which replaced the removed
 * `nxViteTsPaths` plugin. Returns the file unchanged when it is already set or
 * when the config's shape hides the object we would have to edit.
 */
export function addTsconfigPathsResolution(appFileContent: string): string {
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const tsModule: typeof import('typescript') = require('typescript');

  const file = tsquery.ast(appFileContent);
  const config = findConfigObject(tsModule, tsquery, file);
  if (!config) return appFileContent;

  const existingResolve = config.properties.find(
    (prop): prop is import('typescript').PropertyAssignment =>
      tsModule.isPropertyAssignment(prop) &&
      stripQuotes(prop.name.getText()) === 'resolve'
  );

  if (existingResolve) {
    const target = existingResolve.initializer;
    if (!tsModule.isObjectLiteralExpression(target)) return appFileContent;
    if (
      target.properties.some(
        (prop) =>
          prop.name && stripQuotes(prop.name.getText()) === 'tsconfigPaths'
      )
    ) {
      return appFileContent;
    }
    return applyChangesToString(appFileContent, [
      {
        type: ChangeType.Insert,
        index: target.getStart() + 1,
        text: `\n    tsconfigPaths: true,`,
      },
    ]);
  }

  return applyChangesToString(appFileContent, [
    {
      type: ChangeType.Insert,
      index: config.getStart() + 1,
      text: `\n  resolve: {\n    tsconfigPaths: true,\n  },`,
    },
  ]);
}

/**
 * The object literal a Vite config ultimately exports. Handles `defineConfig`
 * called with an object or with a factory, and a bare default export. Returns
 * undefined when the config is assembled somewhere we cannot follow.
 */
function findConfigObject(
  tsModule: typeof import('typescript'),
  tsquery: any,
  file: import('typescript').SourceFile
): import('typescript').ObjectLiteralExpression | undefined {
  const defineConfigCall = tsquery.query(
    file,
    'CallExpression:has(Identifier[name="defineConfig"])'
  )[0] as import('typescript').CallExpression | undefined;

  if (defineConfigCall) {
    return unwrapConfigExpression(tsModule, defineConfigCall.arguments[0]);
  }

  const exportAssignment = tsquery.query(file, 'ExportAssignment')[0] as
    | import('typescript').ExportAssignment
    | undefined;
  if (exportAssignment) {
    return unwrapConfigExpression(tsModule, exportAssignment.expression);
  }

  const moduleExports = tsquery.query(
    file,
    'BinaryExpression:has(PropertyAccessExpression:has(Identifier[name="exports"]))'
  )[0] as import('typescript').BinaryExpression | undefined;
  return moduleExports
    ? unwrapConfigExpression(tsModule, moduleExports.right)
    : undefined;
}

function unwrapConfigExpression(
  tsModule: typeof import('typescript'),
  node: import('typescript').Node | undefined
): import('typescript').ObjectLiteralExpression | undefined {
  if (!node) return undefined;
  if (tsModule.isParenthesizedExpression(node)) {
    return unwrapConfigExpression(tsModule, node.expression);
  }
  if (tsModule.isObjectLiteralExpression(node)) return node;
  if (tsModule.isArrowFunction(node) || tsModule.isFunctionExpression(node)) {
    if (!tsModule.isBlock(node.body)) {
      return unwrapConfigExpression(tsModule, node.body);
    }
    // Only a single, unconditional return is safe to edit.
    const returns = node.body.statements.filter(tsModule.isReturnStatement);
    return returns.length === 1
      ? unwrapConfigExpression(tsModule, returns[0].expression)
      : undefined;
  }
  return undefined;
}

function stripQuotes(text: string): string {
  return text.replace(/^['"`]|['"`]$/g, '');
}

function handleCacheDirNode(appFileContent: string, cacheDir: string): string {
  const { tsquery } = require('@phenomnomnominal/tsquery');

  const file = tsquery.ast(appFileContent);
  const cacheDirNode = tsquery.query(
    file,
    'PropertyAssignment:has(Identifier[name="cacheDir"])'
  );

  if (!cacheDirNode?.length || cacheDirNode?.length === 0) {
    // cacheDir node does not exist yet
    // So make one from scratch

    const foundDefineConfig = tsquery.query(
      file,
      'CallExpression:has(Identifier[name="defineConfig"])'
    );

    if (foundDefineConfig.length) {
      const conditionalConfig = tsquery.query(
        foundDefineConfig[0],
        'ArrowFunction'
      );

      if (conditionalConfig.length) {
        // We are NOT transforming the conditional config
        // with cacheDir
      } else {
        const propertyAssignments = tsquery.query(
          foundDefineConfig[0],
          'PropertyAssignment'
        );

        if (propertyAssignments.length) {
          appFileContent = applyChangesToString(appFileContent, [
            {
              type: ChangeType.Insert,
              index: propertyAssignments[0].getStart(),
              text: cacheDir,
            },
          ]);
        } else {
          appFileContent = applyChangesToString(appFileContent, [
            {
              type: ChangeType.Insert,
              index: foundDefineConfig[0].getStart() + 14,
              text: cacheDir,
            },
          ]);
        }
      }
    } else {
      // cacheDir option does not exist and defineConfig is not used
      // could also potentially be invalid syntax, so try-catch
      try {
        const defaultExport = tsquery.query(file, 'ExportAssignment');
        const found = tsquery?.query(
          defaultExport?.[0],
          'ObjectLiteralExpression'
        );
        const startOfObject = found?.[0].getStart();
        appFileContent = applyChangesToString(appFileContent, [
          {
            type: ChangeType.Insert,
            index: startOfObject + 1,
            text: cacheDir,
          },
        ]);
      } catch {}
    }
  }

  return appFileContent;
}
