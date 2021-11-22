import { findNodes } from '@nrwl/workspace/src/utilities/typescript/find-nodes';
import ts = require('typescript');

export function thereAreProjectsWithConflictingPorts(
  ports: number[],
  mainProjectPort: number
) {
  ports.push(mainProjectPort);
  const uniquePorts = [...new Set(ports)];
  return uniquePorts.length !== ports.length;
}

export function getProjectNamesAndPorts(
  mainJsFile: string,
  mainJsPath: string
): { [key: string]: number } | undefined {
  const file = getTsSourceFileFromString(mainJsFile, mainJsPath);
  const moduleExportsFull = findNodes(file, [
    ts.SyntaxKind.ExpressionStatement,
  ]);

  if (!(moduleExportsFull && moduleExportsFull[0])) {
    return;
  }
  const moduleExports = moduleExportsFull[0];
  const listOfStatements = findNodes(moduleExports, [ts.SyntaxKind.SyntaxList]);

  let indexOfFirstNode = -1;

  const hasRefsObject = listOfStatements[0]?.getChildren()?.find((node) => {
    if (node && node.getText().length > 0 && indexOfFirstNode < 0) {
      indexOfFirstNode = node.getStart();
    }
    return (
      node.kind === ts.SyntaxKind.PropertyAssignment &&
      node.getText().startsWith('refs')
    );
  });

  if (!hasRefsObject) {
    return;
  }

  const getObjectLiteralFromRefsObject = findNodes(hasRefsObject, [
    ts.SyntaxKind.ObjectLiteralExpression,
  ]);

  if (!(getObjectLiteralFromRefsObject && getObjectLiteralFromRefsObject[0])) {
    return;
  }

  const projectPortsByName = {};
  let activeProjectName = '';
  getObjectLiteralFromRefsObject[0].forEachChild((node) => {
    node.forEachChild((childNode) => {
      if (childNode.kind === ts.SyntaxKind.Identifier) {
        activeProjectName = childNode.getText();
      }
      if (childNode.kind === ts.SyntaxKind.ObjectLiteralExpression) {
        if (
          childNode.getText().includes('title:') &&
          childNode.getText().includes('url:')
        ) {
          childNode.forEachChild((grandchildNode) => {
            if (
              grandchildNode.kind === ts.SyntaxKind.PropertyAssignment &&
              grandchildNode.getText().startsWith('url:')
            ) {
              grandchildNode.forEachChild((greatGrandchildNode) => {
                if (
                  greatGrandchildNode.kind === ts.SyntaxKind.StringLiteral &&
                  greatGrandchildNode.getText().includes(`localhost:`)
                ) {
                  const addressParts = greatGrandchildNode
                    .getText()
                    .replace(`'`, '')
                    .split(':');
                  const port = addressParts.find(
                    (part) =>
                      typeof parseInt(part) === 'number' && parseInt(part) > 0
                  );
                  if (port) {
                    projectPortsByName[activeProjectName] = parseInt(port);
                  }
                }
              });
            }
          });
        }
      }
    });
  });

  return projectPortsByName;
}

export function getTsSourceFileFromString(
  fileContents: string,
  path: string
): ts.SourceFile {
  const source = ts.createSourceFile(
    path,
    fileContents,
    ts.ScriptTarget.Latest,
    true
  );
  return source;
}
