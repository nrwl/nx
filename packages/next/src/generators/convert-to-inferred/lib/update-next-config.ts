import { Tree } from '@nx/devkit';
import { findNextConfigPath } from './utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';

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
  let ast = tsquery.ast(nextConfigContents);

  const reservedVarQuery = `
  VariableStatement > VariableDeclarationList > VariableDeclaration:has(Identifier[name=configValues]), 
  VariableStatement > VariableDeclarationList > VariableDeclaration:has(Identifier[name=configuration]),
  VariableStatement > VariableDeclarationList > VariableDeclaration:has(Identifier[name=options])
  `;

  const matches = tsquery(ast, reservedVarQuery);
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
  const composePluginNode = tsquery(ast, composePluginsQuery)[0];

  if (!composePluginNode) {
    migrationLogs.addLog({
      project: project.projectName,
      executorName: '@nx/next:build',
      log: `The project ${project.projectName} does not use a supported Next.js config file format. Only .js and .cjs files using "composePlugins" is supported. Leaving it as is.`,
    });
    return;
  }

  let lastRequireEndPosition = -1;

  const findLastRequire = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require'
    ) {
      lastRequireEndPosition = node.end;
    }
    ts.forEachChild(node, findLastRequire);
  };

  findLastRequire(ast);

  let updatedCode = `
    ${nextConfigContents.slice(0, lastRequireEndPosition)}\n
    ${updatedConfigFileContents}\n\n
    ${nextConfigContents.slice(lastRequireEndPosition)}
    `;
  ast = tsquery.ast(updatedCode);

  const nextConfigNode = tsquery(
    ast,
    'VariableDeclaration:has(Identifier[name=nextConfig]) ObjectLiteralExpression'
  )[0];

  if (nextConfigNode) {
    const nxNode = tsquery(
      nextConfigNode,
      'PropertyAssignment:has(Identifier[name=nx]) ObjectLiteralExpression'
    )[0];

    if (nxNode) {
      const spread = ts.factory.createSpreadAssignment(
        ts.factory.createIdentifier('options')
      );

      const updatedNxNode = ts.factory.updateObjectLiteralExpression(
        nxNode as ts.ObjectLiteralExpression,
        ts.factory.createNodeArray([...nxNode['properties'], spread])
      );

      const transformer =
        <T extends ts.Node>(context: ts.TransformationContext) =>
        (rootNode: T) => {
          function visit(node: ts.Node): ts.Node {
            if (node === nxNode) {
              return updatedNxNode;
            }
            return ts.visitEachChild(node, visit, context);
          }

          return ts.visitNode(rootNode, visit);
        };

      const result = ts.transform(ast, [transformer]);
      const transformedSourceFile = result.transformed[0] as ts.SourceFile;

      const printer = ts.createPrinter();
      updatedCode = printer.printFile(transformedSourceFile);
    }

    tree.write(nextConfigPath, updatedCode);
  }
}
