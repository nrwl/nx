import * as ts from 'typescript';

export function findFunctionCallExpressionStatement(
  nodes: ts.Node[],
  functionName: string
): ts.ExpressionStatement {
  return nodes.find(
    node =>
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.escapedText === functionName
  ) as ts.ExpressionStatement;
}

export function findFunctionCalls(
  sourceFile: ts.SourceFile,
  functionName: string
) {
  return sourceFile.statements.filter(statement => {
    if (!ts.isVariableStatement(statement)) {
      return false;
    }
    const declarations = statement.declarationList.declarations;

    return declarations.some(declaration => {
      if (
        !ts.isCallExpression(declaration.initializer) ||
        !ts.isIdentifier(declaration.initializer.expression)
      ) {
        return false;
      }

      return declaration.initializer.expression.text === functionName;
    });
  }) as ts.VariableStatement[];
}

export function findRequireStatement(nodes: ts.Node[]): ts.VariableStatement {
  return nodes.find(node => {
    if (!ts.isVariableStatement(node)) {
      return false;
    }

    const requireDeclaration = node.declarationList.declarations.find(
      declaration => {
        if (!ts.isCallExpression(declaration.initializer)) {
          return false;
        }

        const callExpression = declaration.initializer;
        if (
          ts.isIdentifier(callExpression.expression) &&
          callExpression.expression.escapedText === 'require' &&
          ts.isStringLiteral(callExpression.arguments[0])
        ) {
          const argument = callExpression.arguments[0] as ts.StringLiteral;
          return (
            argument.text === '@nrwl/schematics/src/utils/cli-config-utils'
          );
        }
        return false;
      }
    ) as ts.VariableDeclaration;

    return !!requireDeclaration;
  }) as ts.VariableStatement;
}

export function findSpecDeclaration(nodes: ts.Node[]) {
  return nodes.find(
    node =>
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'specs' &&
      ts.isArrayLiteralExpression(node.initializer)
  ) as ts.PropertyAssignment;
}

export function findTsNodeRegisterExpression(nodes: ts.Node[]) {
  return nodes.find(
    node =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.name) &&
      node.expression.name.text === 'register' &&
      ts.isCallExpression(node.expression.expression) &&
      ts.isIdentifier(node.expression.expression.expression) &&
      node.expression.expression.expression.text === 'require' &&
      ts.isStringLiteral(node.expression.expression.arguments[0]) &&
      (node.expression.expression.arguments[0] as ts.StringLiteral).text ===
        'ts-node'
  ) as ts.CallExpression;
}
