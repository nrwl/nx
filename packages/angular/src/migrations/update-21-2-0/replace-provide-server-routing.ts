import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import {
  ensureTypescript,
  ast,
  printNodeUpdate,
  query,
  type TypescriptAst,
} from '@nx/devkit/internal';
import type {
  ArrayLiteralExpression,
  CallExpression,
  ImportDeclaration,
  ImportSpecifier,
} from 'typescript';
import { FileChangeRecorder } from '../../utils/file-change-recorder';
import { getProjectsFilteredByDependencies } from '../utils/projects';

let ts: TypescriptAst;

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

  ts ??= ensureTypescript();
  const sourceFile = ast(content);

  const providersArray = query<ArrayLiteralExpression>(
    sourceFile,
    'PropertyAssignment:has(Identifier[name=providers]) > ArrayLiteralExpression'
  )[0];

  if (!providersArray) {
    return;
  }

  if (
    !providersArray.elements.some(
      (el) =>
        ts.isCallExpression(el) &&
        ts.isIdentifier(el.expression) &&
        (el.expression.text === 'provideServerRouting' ||
          el.expression.text === 'provideServerRoutesConfig')
    )
  ) {
    return;
  }

  const recorder = new FileChangeRecorder(tree, filePath);

  let provideServerRenderingCall: CallExpression | undefined;
  let provideServerRoutingCall: CallExpression;

  const providerCallNodes = providersArray.elements.filter((el) =>
    ts.isCallExpression(el)
  );
  for (const node of providerCallNodes) {
    const name = ts.isIdentifier(node.expression)
      ? node.expression.text
      : undefined;
    if (name === 'provideServerRendering') {
      provideServerRenderingCall = node;
    } else if (
      name === 'provideServerRouting' ||
      name === 'provideServerRoutesConfig'
    ) {
      provideServerRoutingCall = node;
    }
  }

  const withRoutesCall = ts.factory.createCallExpression(
    ts.factory.createIdentifier('withRoutes'),
    undefined,
    [provideServerRoutingCall.arguments.at(0)]
  );

  let updatedProvidersArray: ArrayLiteralExpression;
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
    printNodeUpdate(providersArray, updatedProvidersArray)
  );

  const importDecl = sourceFile.statements.find(
    (stmt) =>
      ts.isImportDeclaration(stmt) &&
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      stmt.moduleSpecifier.text === '@angular/ssr'
  ) as ImportDeclaration | undefined;

  if (importDecl?.importClause?.namedBindings) {
    const namedBindings = importDecl?.importClause.namedBindings;

    if (ts.isNamedImports(namedBindings)) {
      // remove the "provideServerRouting" and "provideServerRoutesConfig"
      // imports and ensure we have the "withRoutes" import
      const isImportOf = (el: ImportSpecifier, name: string) =>
        !el.propertyName && el.name.text === name;
      const keptElements = namedBindings.elements.filter(
        (el) =>
          !isImportOf(el, 'provideServerRouting') &&
          !isImportOf(el, 'provideServerRoutesConfig')
      );
      const updatedNamedBindings = ts.factory.updateNamedImports(
        namedBindings,
        keptElements.some((el) => isImportOf(el, 'withRoutes'))
          ? keptElements
          : [
              ...keptElements,
              ts.factory.createImportSpecifier(
                false,
                undefined,
                ts.factory.createIdentifier('withRoutes')
              ),
            ]
      );

      recorder.replace(
        namedBindings,
        printNodeUpdate(namedBindings, updatedNamedBindings)
      );
    }
  }

  recorder.applyChanges();
}
