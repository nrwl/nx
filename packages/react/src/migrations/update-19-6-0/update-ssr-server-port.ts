import {
  ProjectConfiguration,
  type Tree,
  getProjects,
  joinPathFragments,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';
import { minimatch } from 'minimatch';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { type WebSsrDevServerOptions } from '@nx/webpack/src/executors/ssr-dev-server/schema';

export default function update(tree: Tree) {
  const projects = getProjects(tree);
  const executors = [
    '@nx/webpack:ssr-dev-server',
    '@nx/react:module-federation-ssr-dev-server',
  ];

  executors.forEach((executor) => {
    forEachExecutorOptions<WebSsrDevServerOptions>(
      tree,
      executor,
      (options, projectName) => {
        const project = projects.get(projectName);
        if (isModuleFederationSSRProject(tree, project)) {
          const port = options.port;
          if (tree.exists(joinPathFragments(project.root, 'server.ts'))) {
            const serverContent = tree.read(
              joinPathFragments(project.root, 'server.ts'),
              'utf-8'
            );
            if (serverContent && port) {
              const updatedServerContent = updateServerPort(
                serverContent,
                port
              );
              if (updatedServerContent) {
                tree.write(
                  joinPathFragments(project.root, 'server.ts'),
                  updatedServerContent
                );
              }
            }
          }
        }
      }
    );
  });
}

function updateServerPort(serverContent: string, port: number) {
  const sourceFile = tsquery.ast(serverContent);

  const serverPortNode = tsquery(
    sourceFile,
    `VariableDeclaration:has(Identifier[name="port"])`
  )[0];
  if (serverPortNode) {
    const binaryExpression = tsquery(serverPortNode, 'BinaryExpression')[0];
    if (binaryExpression) {
      const leftExpression = tsquery(
        binaryExpression,
        'PropertyAccessExpression:has(Identifier[name="env"])'
      )[0];
      const rightExpression = tsquery(
        binaryExpression,
        'NumericLiteral[text="4200"]'
      )[0];

      if (leftExpression && rightExpression) {
        const serverPortDeclaration = serverPortNode as ts.VariableDeclaration;
        const newInitializer = ts.factory.createBinaryExpression(
          // process.env.PORT
          ts.factory.createPropertyAccessExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier('process'),
              ts.factory.createIdentifier('env')
            ),
            'PORT'
          ),
          // ||
          ts.SyntaxKind.BarBarToken,
          // port value
          ts.factory.createNumericLiteral(port.toString())
        );

        const updatePortDeclaration = ts.factory.updateVariableDeclaration(
          serverPortDeclaration,
          serverPortDeclaration.name,
          serverPortDeclaration.exclamationToken,
          serverPortDeclaration.type,
          newInitializer
        );

        const updatedStatements = sourceFile.statements.map((statement) => {
          if (ts.isVariableStatement(statement)) {
            const updatedDeclarationList =
              statement.declarationList.declarations.map((decl) =>
                decl === serverPortDeclaration ? updatePortDeclaration : decl
              );

            const updatedDeclList = ts.factory.updateVariableDeclarationList(
              statement.declarationList,
              updatedDeclarationList
            );

            return ts.factory.updateVariableStatement(
              statement,
              statement.modifiers,
              updatedDeclList
            );
          }

          return statement;
        });

        const updatedSourceFile = ts.factory.updateSourceFile(
          sourceFile,
          updatedStatements
        );

        const printer = ts.createPrinter();
        return printer.printNode(
          ts.EmitHint.Unspecified,
          updatedSourceFile,
          sourceFile
        );
      }
    }
  }
}

function isModuleFederationSSRProject(
  tree: Tree,
  project: ProjectConfiguration
) {
  let hasMfeServerConfig = false;
  visitNotIgnoredFiles(tree, project.root, (filePath) => {
    if (minimatch(filePath, '**/module-federation*.server.config.*')) {
      hasMfeServerConfig = true;
    }
  });
  return hasMfeServerConfig;
}
