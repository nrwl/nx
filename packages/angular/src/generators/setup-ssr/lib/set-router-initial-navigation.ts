import {
  readProjectConfiguration,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import { insertImport } from '@nx/js';
import {
  ast,
  ensureTypescript,
  printNodeUpdate,
  query,
  type TypescriptAst,
} from '@nx/devkit/internal';
import type {
  CallExpression,
  Expression,
  ImportSpecifier,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  SourceFile,
} from 'typescript';
import type { NormalizedGeneratorOptions } from '../schema';

let ts: TypescriptAst;

export function setRouterInitialNavigation(
  tree: Tree,
  options: NormalizedGeneratorOptions
): void {
  ts ??= ensureTypescript();
  const project = readProjectConfiguration(tree, options.project);

  visitNotIgnoredFiles(tree, project.root, (filePath) => {
    // we are only interested in .ts files
    if (!filePath.endsWith('.ts')) {
      return;
    }

    if (options.standalone) {
      processFileWithStandaloneSetup(tree, filePath);
    } else {
      processFileWithNgModuleSetup(tree, filePath);
    }
  });
}

function processFileWithStandaloneSetup(tree: Tree, filePath: string) {
  let content = tree.read(filePath, 'utf-8');
  let sourceFile = ast(content);

  const provideRouterCallExpression =
    getProvideRouterCallExpression(sourceFile);
  if (!provideRouterCallExpression) {
    return;
  }

  if (
    provideRouterCallExpression.arguments.some(
      (arg) =>
        ts.isCallExpression(arg) &&
        ts.isIdentifier(arg.expression) &&
        arg.expression.text === 'withEnabledBlockingInitialNavigation'
    )
  ) {
    return;
  }

  const updatedProvideRouterCallExpression = printNodeUpdate(
    provideRouterCallExpression,
    updateProvideRouterCallExpression(provideRouterCallExpression)
  );

  content = `${content.slice(
    0,
    provideRouterCallExpression.getStart()
  )}${updatedProvideRouterCallExpression}${content.slice(
    provideRouterCallExpression.getEnd()
  )}`;

  tree.write(filePath, content);

  sourceFile = ast(content);
  sourceFile = insertImport(
    tree,
    sourceFile,
    filePath,
    'withEnabledBlockingInitialNavigation',
    '@angular/router'
  );

  const withDisabledInitialNavigationImportNode = query(
    sourceFile,
    'ImportDeclaration ImportSpecifier:has(Identifier[name=withDisabledInitialNavigation])'
  )[0] as ImportSpecifier;
  if (!withDisabledInitialNavigationImportNode) {
    return;
  }

  const hasTrailingComma =
    withDisabledInitialNavigationImportNode.parent.elements.hasTrailingComma;

  content = tree.read(filePath, 'utf-8');
  tree.write(
    filePath,
    `${content.slice(
      0,
      withDisabledInitialNavigationImportNode.getStart()
    )}${content.slice(
      withDisabledInitialNavigationImportNode.getEnd() +
        (hasTrailingComma ? 1 : 0)
    )}`
  );
}

function updateProvideRouterCallExpression(
  node: CallExpression
): CallExpression {
  const filteredArgs = node.arguments.filter(
    (arg) =>
      !(
        ts.isCallExpression(arg) &&
        ts.isIdentifier(arg.expression) &&
        arg.expression.text === 'withDisabledInitialNavigation'
      )
  );

  const initialNavigationFeatureArg = ts.factory.createCallExpression(
    ts.factory.createIdentifier('withEnabledBlockingInitialNavigation'),
    [],
    []
  );

  return ts.factory.updateCallExpression(
    node,
    node.expression,
    node.typeArguments,
    [...filteredArgs, initialNavigationFeatureArg]
  );
}

function processFileWithNgModuleSetup(tree: Tree, filePath: string) {
  const content = tree.read(filePath, 'utf-8');
  const sourceFile = ast(content);

  const routerModuleForRootCallExpression =
    getRouterModuleForRootCallExpression(sourceFile);
  if (!routerModuleForRootCallExpression) {
    return;
  }

  // The printer can't print parsed code inside a built spread, so options
  // passed by reference are replaced as text.
  const { arguments: args } = routerModuleForRootCallExpression;
  const optionsArgument = args[1];
  const spreadOptions = optionsArgument && getSpreadOptions(optionsArgument);
  if (spreadOptions) {
    // Like the update below, drop the arguments after the options with their
    // comments. An argument's full start follows its comma.
    const dropStart =
      args.length > 2 ? args[2].pos - 1 : optionsArgument.getEnd();
    tree.write(
      filePath,
      `${content.slice(0, optionsArgument.getStart())}{ ${spreadOptions}, initialNavigation: 'enabledBlocking' }${content.slice(
        optionsArgument.getEnd(),
        dropStart
      )}${content.slice(args[args.length - 1].getEnd())}`
    );
    return;
  }

  const updatedRouterModuleForRootCallExpression = printNodeUpdate(
    routerModuleForRootCallExpression,
    updateRouterModuleForRootCallExpression(routerModuleForRootCallExpression)
  );

  tree.write(
    filePath,
    `${content.slice(
      0,
      routerModuleForRootCallExpression.getStart()
    )}${updatedRouterModuleForRootCallExpression}${content.slice(
      routerModuleForRootCallExpression.getEnd()
    )}`
  );
}

function updateRouterModuleForRootCallExpression(
  node: CallExpression
): CallExpression {
  const existingOptions = node.arguments[1] as
    | ObjectLiteralExpression
    | undefined;

  const existingProperties = existingOptions?.properties
    ? ts.factory.createNodeArray(
        existingOptions.properties.filter(
          (exp) =>
            !(
              ts.isPropertyAssignment(exp) &&
              ts.isIdentifier(exp.name) &&
              exp.name.text === 'initialNavigation'
            )
        )
      )
    : ts.factory.createNodeArray<ObjectLiteralElementLike>();

  const enabledLiteral = ts.factory.createStringLiteral(
    'enabledBlocking',
    true
  );
  const initialNavigationProperty = ts.factory.createPropertyAssignment(
    'initialNavigation',
    enabledLiteral
  );

  const routerOptions = existingOptions
    ? ts.factory.updateObjectLiteralExpression(
        existingOptions,
        ts.factory.createNodeArray([
          ...existingProperties,
          initialNavigationProperty,
        ])
      )
    : ts.factory.createObjectLiteralExpression(
        ts.factory.createNodeArray([initialNavigationProperty])
      );
  const args = [node.arguments[0], routerOptions];

  return ts.factory.updateCallExpression(
    node,
    node.expression,
    node.typeArguments,
    args
  );
}

// `?? {}` lets a value typed `undefined` be spread (TS2698). Other expressions
// aren't spread, since TypeScript rejects `??` after some of them (TS2869).
function getSpreadOptions(optionsArgument: Expression): string | undefined {
  const value = skipWrappers(optionsArgument);
  if (
    !(ts.isIdentifier(value) && value.text !== 'undefined') &&
    !ts.isPropertyAccessExpression(value) &&
    !ts.isElementAccessExpression(value) &&
    !ts.isCallExpression(value)
  ) {
    return undefined;
  }
  let operand = optionsArgument;
  while (ts.isParenthesizedExpression(operand)) {
    operand = operand.expression;
  }
  const operandText =
    ts.isAsExpression(operand) || ts.isSatisfiesExpression(operand)
      ? `(${operand.getText()})`
      : operand.getText();
  return `...(${operandText} ?? {})`;
}

function skipWrappers(expression: Expression): Expression {
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    expression = expression.expression;
  }
  return expression;
}

function getProvideRouterCallExpression(
  sourceFile: SourceFile
): CallExpression | null {
  const routerModuleForRootCalls = query(
    sourceFile,
    'PropertyAssignment:has(Identifier[name=providers]) > ArrayLiteralExpression CallExpression:has(Identifier[name=provideRouter])'
  ) as CallExpression[];

  return routerModuleForRootCalls.length ? routerModuleForRootCalls[0] : null;
}

function getRouterModuleForRootCallExpression(
  sourceFile: SourceFile
): CallExpression | null {
  const routerModuleForRootCalls = query(
    sourceFile,
    'Decorator > CallExpression:has(Identifier[name=NgModule]) PropertyAssignment:has(Identifier[name=imports]) > ArrayLiteralExpression CallExpression:has(Identifier[name=forRoot])'
  ) as CallExpression[];

  return routerModuleForRootCalls.length ? routerModuleForRootCalls[0] : null;
}
