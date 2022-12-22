import { applyChangesToString, ChangeType, Tree } from '@nrwl/devkit';
import { findNodes } from 'nx/src/utils/typescript';
import ts = require('typescript');
import { tsquery } from '@phenomnomnominal/tsquery';

export function ensureBuildOptionsInViteConfig(
  tree: Tree,
  path: string,
  buildConfigContent: string,
  buildConfigObject: {},
  dtsPlugin: string,
  dtsImportLine: string,
  pluginOption: string
): boolean {
  const fileContent = tree.read(path, 'utf-8');
  const file = tsquery.ast(fileContent);
  const newContent = handlePluginNode(
    file,
    fileContent,
    dtsPlugin,
    dtsImportLine,
    pluginOption
  );

  const buildUpdatedContent = handleBuildNode(
    newContent ?? fileContent,
    buildConfigContent,
    buildConfigObject
  );

  if (buildUpdatedContent) {
    tree.write(path, buildUpdatedContent);
    return true;
  } else {
    return false;
  }
}

function handleBuildNode(
  updatedFileContent: string,
  buildConfigContent: string,
  buildConfigObject: {}
): string | undefined {
  const buildNode = tsquery.query(
    updatedFileContent,
    'PropertyAssignment:has(Identifier[name="build"])'
  );

  if (buildNode.length) {
    return tsquery.replace(
      updatedFileContent,
      'PropertyAssignment:has(Identifier[name="build"])',
      (node: ts.Node) => {
        const found = tsquery.query(node, 'ObjectLiteralExpression');
        return `build: {
                  ...${found?.[0].getText()},
                  ...${JSON.stringify(buildConfigObject)}
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
        return transformConditionalConfig(
          conditionalConfig,
          updatedFileContent,
          buildConfigContent
        );
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
              text: buildConfigContent,
            },
          ]);
        } else {
          return applyChangesToString(updatedFileContent, [
            {
              type: ChangeType.Insert,
              index: foundDefineConfig[0].getStart() + 14,
              text: buildConfigContent,
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
        const found = tsquery?.query(
          defaultExport?.[0],
          'ObjectLiteralExpression'
        );
        const startOfObject = found?.[0].getStart();
        return applyChangesToString(updatedFileContent, [
          {
            type: ChangeType.Insert,
            index: startOfObject + 1,
            text: buildConfigContent,
          },
        ]);
      } catch {
        return undefined;
      }
    }
  }
}

function transformCurrentBuildObject(
  index: number,
  returnStatements: ts.ReturnStatement[],
  appFileContent: string,

  buildConfigObject: {}
): string | undefined {
  if (!returnStatements?.[index]) {
    return undefined;
  }
  const currentBuildObject = tsquery
    .query(returnStatements[index], 'ObjectLiteralExpression')?.[0]
    .getText();

  const currentBuildObjectStart = returnStatements[index].getStart();
  const currentBuildObjectEnd = returnStatements[index].getEnd();

  const newReturnObject = tsquery.replace(
    returnStatements[index].getText(),
    'ObjectLiteralExpression',
    (_node: ts.Node) => {
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
  conditionalConfig: ts.Node[],
  appFileContent: string,
  buildConfigObject: {}
): string | undefined {
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

  const elseKeywordExists = findNodes(
    ifStatement?.[0],
    ts.SyntaxKind.ElseKeyword
  );
  const returnStatements: ts.ReturnStatement[] = tsquery.query(
    ifStatement[0],
    'ReturnStatement'
  );

  if (!buildExists) {
    if (serveExists && elseKeywordExists) {
      // build options live inside the else block

      return transformCurrentBuildObject(
        returnStatements?.length - 1,
        returnStatements,
        appFileContent,
        buildConfigObject
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

    return transformCurrentBuildObject(
      buildExistsExpressionIndex,
      returnStatements,
      appFileContent,
      buildConfigObject
    );
  }
}

function handlePluginNode(
  file: ts.SourceFile,
  appFileContent: string,
  dtsPlugin: string,
  dtsImportLine: string,
  pluginOption: string
): string | undefined {
  const pluginsNode = tsquery.query(
    file,
    'PropertyAssignment:has(Identifier[name="plugins"])'
  );

  let writeFile = false;

  if (pluginsNode.length) {
    appFileContent = tsquery.replace(
      file.getText(),
      'PropertyAssignment:has(Identifier[name="plugins"])',
      (node: ts.Node) => {
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
      if (appFileContent.includes('/// <reference types="vitest" />')) {
        return appFileContent.replace(
          '/// <reference types="vitest" />',
          `/// <reference types="vitest" />
            ${dtsImportLine}\n`
        );
      } else {
        return dtsImportLine + '\n' + appFileContent;
      }
    }
    return appFileContent;
  }
  return undefined;
}
