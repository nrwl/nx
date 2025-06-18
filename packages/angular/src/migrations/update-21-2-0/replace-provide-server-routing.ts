import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';
import { FileChangeRecorder } from '../../utils/file-change-recorder';
import { getProjectsFilteredByDependencies } from '../utils/projects';

export default async function (tree: Tree) {
  const projects = await getProjectsFilteredByDependencies([
    'npm:@angular/ssr',
  ]);

  if (!projects.length) {
    return;
  }

  for (const graphNode of projects) {
    visitNotIgnoredFiles(tree, graphNode.data.root, (file) => {
      if (!file.endsWith('.ts') || file.endsWith('.d.ts')) {
        return;
      }

      processFile(tree, file);
    });
  }

  await formatFiles(tree);
}

function processFile(tree: Tree, filePath: string): void {
  const content = tree.read(filePath, 'utf-8');

  if (
    (!content.includes('provideServerRouting') &&
      !content.includes('provideServerRoutesConfig')) ||
    !content.includes('@angular/ssr')
  ) {
    return;
  }

  const sourceFile = tsquery.ast(content);

  const providersArray = tsquery.query<ts.ArrayLiteralExpression>(
    sourceFile,
    'PropertyAssignment:has(Identifier[name=providers]) > ArrayLiteralExpression',
    { visitAllChildren: true }
  )[0];

  if (!providersArray) {
    return;
  }

  if (
    !providersArray.elements.some(
      (el) =>
        ts.isCallExpression(el) &&
        ts.isIdentifier(el.expression) &&
        (el.expression.getText() === 'provideServerRouting' ||
          el.expression.getText() === 'provideServerRoutesConfig')
    )
  ) {
    return;
  }

  const recorder = new FileChangeRecorder(tree, filePath);
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });

  let provideServerRenderingCall: ts.CallExpression | undefined;
  let provideServerRoutingCall: ts.CallExpression;

  const providerCallNodes = providersArray.elements.filter((el) =>
    ts.isCallExpression(el)
  );
  for (const node of providerCallNodes) {
    if (node.expression.getText() === 'provideServerRendering') {
      provideServerRenderingCall = node;
    } else if (
      node.expression.getText() === 'provideServerRouting' ||
      node.expression.getText() === 'provideServerRoutesConfig'
    ) {
      provideServerRoutingCall = node;
    }
  }

  const withRoutesCall = ts.factory.createCallExpression(
    ts.factory.createIdentifier('withRoutes'),
    undefined,
    [provideServerRoutingCall.arguments.at(0)]
  );

  let updatedProvidersArray: ts.ArrayLiteralExpression;
  if (provideServerRenderingCall) {
    // remove the "provideServerRouting" and "provideServerRoutesConfig"
    // calls and update the existing "provideServerRendering" call
    updatedProvidersArray = ts.factory.updateArrayLiteralExpression(
      providersArray,
      providersArray.elements
        .filter(
          (el) =>
            !(
              ts.isCallExpression(el) &&
              ts.isIdentifier(el.expression) &&
              (el.expression.text === 'provideServerRouting' ||
                el.expression.text === 'provideServerRoutesConfig')
            )
        )
        .map((el) => {
          if (
            ts.isCallExpression(el) &&
            ts.isIdentifier(el.expression) &&
            el.expression.text === 'provideServerRendering'
          ) {
            return ts.factory.updateCallExpression(
              el,
              el.expression,
              el.typeArguments,
              [withRoutesCall, ...provideServerRoutingCall.arguments.slice(1)]
            );
          }

          return el;
        })
    );
  } else {
    // replace the "provideServerRouting" and "provideServerRoutesConfig"
    // calls with the new "provideServerRendering" call
    updatedProvidersArray = ts.factory.updateArrayLiteralExpression(
      providersArray,
      providersArray.elements.map((el) => {
        if (
          ts.isCallExpression(el) &&
          ts.isIdentifier(el.expression) &&
          (el.expression.text === 'provideServerRouting' ||
            el.expression.text === 'provideServerRoutesConfig')
        ) {
          return ts.factory.createCallExpression(
            ts.factory.createIdentifier('provideServerRendering'),
            undefined,
            [withRoutesCall, ...provideServerRoutingCall.arguments.slice(1)]
          );
        }

        return el;
      })
    );
  }

  recorder.replace(
    providersArray,
    printer.printNode(
      ts.EmitHint.Unspecified,
      updatedProvidersArray,
      sourceFile
    )
  );

  const importDecl = sourceFile.statements.find(
    (stmt) =>
      ts.isImportDeclaration(stmt) &&
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      stmt.moduleSpecifier.text === '@angular/ssr'
  ) as ts.ImportDeclaration | undefined;

  if (importDecl?.importClause?.namedBindings) {
    const namedBindings = importDecl?.importClause.namedBindings;

    if (ts.isNamedImports(namedBindings)) {
      // remove the "provideServerRouting" and "provideServerRoutesConfig"
      // imports and ensure we have the "withRoutes" import
      const updatedElementNames = new Set([
        ...namedBindings.elements
          .map((el) => el.getText())
          .filter(
            (x) =>
              x !== 'provideServerRouting' && x !== 'provideServerRoutesConfig'
          ),
        'withRoutes',
      ]);
      const updatedNamedBindings = ts.factory.updateNamedImports(
        namedBindings,
        Array.from(updatedElementNames).map((name) =>
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier(name)
          )
        )
      );

      const printer = ts.createPrinter({
        newLine: ts.NewLineKind.LineFeed,
      });
      recorder.replace(
        namedBindings,
        printer.printNode(
          ts.EmitHint.Unspecified,
          updatedNamedBindings,
          sourceFile
        )
      );
    }
  }

  recorder.applyChanges();
}
