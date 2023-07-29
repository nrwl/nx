import { applyChangesToString, ChangeType, Tree } from '@nx/devkit';
import { findNodes } from '@nx/js';
import { TargetFlags } from './generator-utils';
import type { Node, ReturnStatement } from 'typescript';

export function ensureViteConfigIsCorrect(
  tree: Tree,
  path: string,
  buildConfigString: string,
  buildConfigObject: {},
  dtsPlugin: string,
  dtsImportLine: string,
  pluginOption: string,
  testConfigString: string,
  testConfigObject: {},
  cacheDir: string,
  projectAlreadyHasViteTargets?: TargetFlags
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
    updatedContent = handlePluginNode(
      updatedContent ?? fileContent,
      dtsPlugin,
      dtsImportLine,
      pluginOption
    );

    updatedContent = handleBuildOrTestNode(
      updatedContent ?? fileContent,
      buildConfigString,
      buildConfigObject,
      'build'
    );
  }

  if (cacheDir?.length) {
    updatedContent = handleCacheDirNode(
      updatedContent ?? fileContent,
      cacheDir
    );
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
  const buildNode = tsquery.query(
    updatedFileContent,
    `PropertyAssignment:has(Identifier[name="${name}"])`
  );

  if (buildNode.length) {
    return tsquery.replace(
      updatedFileContent,
      `PropertyAssignment:has(Identifier[name="${name}"])`,
      (node: Node) => {
        const found = tsquery.query(node, 'ObjectLiteralExpression');
        return `${name}: {
                  ...${found?.[0].getText()},
                  ...${JSON.stringify(configContentObject)}
               }`;
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
  dtsPlugin: string,
  dtsImportLine: string,
  pluginOption: string
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
        const found = tsquery.query(node, 'ArrayLiteralExpression');
        return `plugins: [
                    ...${found?.[0].getText()},
                    ${dtsPlugin}
                ]`;
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
              text: pluginOption,
            },
          ]);
          writeFile = true;
        } else {
          appFileContent = applyChangesToString(appFileContent, [
            {
              type: ChangeType.Insert,
              index: foundDefineConfig[0].getStart() + 14,
              text: pluginOption,
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
            text: pluginOption,
          },
        ]);
        writeFile = true;
      } catch {
        writeFile = false;
      }
    }
  }

  if (writeFile) {
    if (!appFileContent.includes(`import dts from 'vite-plugin-dts'`)) {
      return dtsImportLine + '\n' + appFileContent;
    }
    return appFileContent;
  }
  return appFileContent;
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
