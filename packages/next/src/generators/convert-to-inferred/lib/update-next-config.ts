import { Tree } from '@nx/devkit';
import {
  AggregatedLog,
  ensureTypescript,
  ast,
  query,
  printNodeUpdate,
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

  const callsRequire = (node: Node): boolean =>
    (ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require') ||
    ts.forEachChild(node, callsRequire) === true;

  // Insert after the `;` only when spaces alone precede it. Otherwise insert at
  // the code's end, so comments move down with the `;` and the code they cover.
  let insertAt = -1;
  for (const statement of sourceFile.statements) {
    if (callsRequire(statement)) {
      const codeEnd = ts.isVariableStatement(statement)
        ? statement.declarationList.end
        : ts.isExpressionStatement(statement)
          ? statement.expression.end
          : statement.end;
      insertAt = /^[ \t]*;?$/.test(
        nextConfigContents.slice(codeEnd, statement.end)
      )
        ? statement.end
        : codeEnd;
    }
  }

  // What is left on the line moves to its own line. A blank line below the
  // statement becomes the gap after the block.
  let rest = nextConfigContents.slice(insertAt).replace(/^[ \t]+/, '');
  rest = rest.startsWith('\n')
    ? rest.replace(/^\n(?=[ \t]*\n)/, '')
    : `\n${rest}`;
  let updatedCode = `${nextConfigContents.slice(0, insertAt)}\n\n${updatedConfigFileContents}\n${rest}`;
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

    if (nxNode) {
      const spread = ts.factory.createSpreadAssignment(
        ts.factory.createIdentifier('options')
      );

      const updatedNxNode = ts.factory.updateObjectLiteralExpression(
        nxNode,
        ts.factory.createNodeArray([...nxNode.properties, spread])
      );

      updatedCode =
        updatedCode.slice(0, nxNode.getStart()) +
        printNodeUpdate(nxNode, updatedNxNode) +
        updatedCode.slice(nxNode.getEnd());
    }

    tree.write(nextConfigPath, updatedCode);
  }
}
