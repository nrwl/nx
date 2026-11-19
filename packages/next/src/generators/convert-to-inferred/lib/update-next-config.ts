import {
  applyChangesToString,
  ChangeType,
  type StringChange,
  type Tree,
} from '@nx/devkit';
import {
  AggregatedLog,
  ensureTypescript,
  ast,
  query,
  type TypescriptAst,
} from '@nx/devkit/internal';
import type { Node, ObjectLiteralExpression } from 'typescript';
import { findNextConfigPath } from './utils';

let ts: TypescriptAst;

export function updateNextConfig(
  tree: Tree,
  updatedConfigFileContents: string,
  project: { projectName: string; root: string },
  migrationLogs: AggregatedLog
) {
  const nextConfigPath = findNextConfigPath(tree, project.root);
  if (!nextConfigPath) {
    migrationLogs.addLog({
      project: project.projectName,
      executorName: '@nx/next:build',
      log: `The project ${project.projectName} does not use a supported Next.js config file format. Only .js and .cjs files using "composePlugins" is supported. Leaving it as is.`,
    });
    return;
  }

  const nextConfigContents = tree.read(nextConfigPath, 'utf-8');
  let sourceFile = ast(nextConfigContents);

  const reservedVarQuery = `
  VariableStatement VariableDeclarationList > VariableDeclaration:has(Identifier[name=configValues]),
  VariableStatement VariableDeclarationList > VariableDeclaration:has(Identifier[name=configuration]),
  VariableStatement VariableDeclarationList > VariableDeclaration:has(Identifier[name=options])
  `;

  const matches = query(sourceFile, reservedVarQuery);
  if (matches.length > 0) {
    migrationLogs.addLog({
      project: project.projectName,
      executorName: '@nx/next:build',
      log: `The project (${project.projectName}) Next.js config contains reserved variables ('options', 'configValues' or 'configuration') which are generated during the migration. Leaving it as is.`,
    });
    return;
  }

  // Query to check for composePlugins in module.exports
  const composePluginsQuery = `ExpressionStatement > BinaryExpression > CallExpression > CallExpression:has(Identifier[name=composePlugins])`;
  const composePluginNode = query(sourceFile, composePluginsQuery)[0];

  if (!composePluginNode) {
    migrationLogs.addLog({
      project: project.projectName,
      executorName: '@nx/next:build',
      log: `The project ${project.projectName} does not use a supported Next.js config file format. Only .js and .cjs files using "composePlugins" is supported. Leaving it as is.`,
    });
    return;
  }

  ts ??= ensureTypescript();

  let lastRequireEndPosition = -1;

  const findLastRequire = (node: Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require'
    ) {
      lastRequireEndPosition = node.end;
    }
    ts.forEachChild(node, findLastRequire);
  };

  findLastRequire(sourceFile);

  const updatedCode = `${nextConfigContents.slice(0, lastRequireEndPosition)}\n\n${updatedConfigFileContents}\n\n${nextConfigContents.slice(lastRequireEndPosition)}`;
  sourceFile = ast(updatedCode);

  const nextConfigNode = query(
    sourceFile,
    'VariableDeclaration:has(Identifier[name=nextConfig]) ObjectLiteralExpression'
  )[0];

  if (nextConfigNode) {
    const nxNode = query<ObjectLiteralExpression>(
      nextConfigNode,
      'PropertyAssignment:has(Identifier[name=nx]) ObjectLiteralExpression'
    )[0];

    tree.write(
      nextConfigPath,
      nxNode
        ? applyChangesToString(
            updatedCode,
            addOptionsSpread(updatedCode, nxNode)
          )
        : updatedCode
    );
  }
}

function addOptionsSpread(
  code: string,
  object: ObjectLiteralExpression
): StringChange[] {
  const closeBrace = object.getEnd() - 1;
  const properties = object.properties;
  if (properties.length === 0) {
    const padding = /\s/.test(code[closeBrace - 1]) ? '' : ' ';
    return [
      {
        type: ChangeType.Insert,
        index: closeBrace,
        text: `${padding}...options `,
      },
    ];
  }

  const lastProperty = properties[properties.length - 1];
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    code,
    undefined,
    lastProperty.getEnd()
  );
  const hasTrailingComma = scanner.scan() === ts.SyntaxKind.CommaToken;
  const lastEntryEnd = hasTrailingComma
    ? scanner.getTokenEnd()
    : lastProperty.getEnd();
  const closeBraceLineStart = code.lastIndexOf('\n', closeBrace) + 1;
  if (closeBraceLineStart <= lastEntryEnd) {
    return [
      {
        type: ChangeType.Insert,
        index: lastProperty.getEnd(),
        text: ', ...options',
      },
    ];
  }

  const lastPropertyLineStart =
    code.lastIndexOf('\n', lastProperty.getStart()) + 1;
  const indent = code.slice(lastPropertyLineStart).match(/^[ \t]*/)[0];
  const changes: StringChange[] = [
    {
      type: ChangeType.Insert,
      index: closeBraceLineStart,
      text: `${indent}...options${hasTrailingComma ? ',' : ''}\n`,
    },
  ];
  if (!hasTrailingComma) {
    changes.push({
      type: ChangeType.Insert,
      index: lastProperty.getEnd(),
      text: ',',
    });
  }
  return changes;
}
