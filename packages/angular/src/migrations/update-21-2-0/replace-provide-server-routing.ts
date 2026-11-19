import { formatFiles, visitNotIgnoredFiles, type Tree } from '@nx/devkit';
import {
  ensureTypescript,
  ast,
  query,
  type TypescriptAst,
} from '@nx/devkit/internal';
import type {
  ArrayLiteralExpression,
  CallExpression,
  ImportDeclaration,
  Node,
} from 'typescript';
import {
  FileChangeRecorder,
  spliceListElements,
} from '../../utils/file-change-recorder';
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

  if (!providersArray.elements.some(isServerRoutingCall)) {
    return;
  }

  const recorder = new FileChangeRecorder(tree, filePath);

  let provideServerRenderingCall: CallExpression | undefined;
  let provideServerRoutingCall: CallExpression;

  const providerCallNodes = providersArray.elements.filter((el) =>
    ts.isCallExpression(el)
  );
  for (const node of providerCallNodes) {
    if (isProvideServerRenderingCall(node)) {
      provideServerRenderingCall = node;
    } else if (isServerRoutingCall(node)) {
      provideServerRoutingCall = node;
    }
  }

  const [routesArgument] = provideServerRoutingCall.arguments;
  const lastRoutingArgument =
    provideServerRoutingCall.arguments[
      provideServerRoutingCall.arguments.length - 1
    ];
  const provideServerRenderingArguments = `withRoutes(${routesArgument.getText()})${content.slice(
    routesArgument.getEnd(),
    lastRoutingArgument.getEnd()
  )}`;

  if (provideServerRenderingCall) {
    // remove the "provideServerRouting" and "provideServerRoutesConfig"
    // calls and update the existing "provideServerRendering" call
    spliceListElements(
      recorder,
      providersArray.elements,
      providersArray.getEnd() - 1,
      isServerRoutingCall
    );
    for (const el of providersArray.elements) {
      if (isProvideServerRenderingCall(el)) {
        const args = el.arguments;
        if (args.length) {
          recorder.remove(args[0].getStart(), args[args.length - 1].getEnd());
          recorder.insertLeft(
            args[0].getStart(),
            provideServerRenderingArguments
          );
        } else {
          recorder.insertLeft(el.getEnd() - 1, provideServerRenderingArguments);
        }
      }
    }
  } else {
    // replace the "provideServerRouting" and "provideServerRoutesConfig"
    // calls with the new "provideServerRendering" call
    for (const el of providersArray.elements) {
      if (isServerRoutingCall(el)) {
        recorder.replace(
          el,
          `provideServerRendering(${provideServerRenderingArguments})`
        );
      }
    }
  }

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
      spliceListElements(
        recorder,
        namedBindings.elements,
        namedBindings.getEnd() - 1,
        (el) =>
          el.getText() === 'provideServerRouting' ||
          el.getText() === 'provideServerRoutesConfig',
        namedBindings.elements.some((el) => el.getText() === 'withRoutes')
          ? undefined
          : 'withRoutes'
      );
    }
  }

  recorder.applyChanges();
}

function isProvideServerRenderingCall(node: Node): node is CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'provideServerRendering'
  );
}

function isServerRoutingCall(node: Node): node is CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    (node.expression.text === 'provideServerRouting' ||
      node.expression.text === 'provideServerRoutesConfig')
  );
}
