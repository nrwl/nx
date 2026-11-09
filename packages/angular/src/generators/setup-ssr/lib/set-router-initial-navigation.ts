import {
  readProjectConfiguration,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import { insertImport } from '@nx/js';
import {
  ensureTypescript,
  tsquery,
  type TypescriptAst,
} from '@nx/devkit/internal';
import type {
  CallExpression,
  Expression,
  ImportSpecifier,
  Node,
  SourceFile,
} from 'typescript';
import {
  FileChangeRecorder,
  spliceListElements,
} from '../../../utils/file-change-recorder';
import type { NormalizedGeneratorOptions } from '../schema';

let ts: TypescriptAst;

const INITIAL_NAVIGATION_PROPERTY = `initialNavigation: 'enabledBlocking'`;

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
  let sourceFile = tsquery.ast(content);

  const provideRouterCallExpression =
    getProvideRouterCallExpression(sourceFile);
  if (!provideRouterCallExpression) {
    return;
  }

  if (
    provideRouterCallExpression.arguments.some((arg) =>
      isCallTo(arg, 'withEnabledBlockingInitialNavigation')
    )
  ) {
    return;
  }

  const recorder = new FileChangeRecorder(tree, filePath);
  spliceListElements(
    recorder,
    provideRouterCallExpression.arguments,
    provideRouterCallExpression.getEnd() - 1,
    (arg) => isCallTo(arg, 'withDisabledInitialNavigation'),
    'withEnabledBlockingInitialNavigation()'
  );
  recorder.applyChanges();

  sourceFile = tsquery.ast(recorder.content);
  sourceFile = insertImport(
    tree,
    sourceFile,
    filePath,
    'withEnabledBlockingInitialNavigation',
    '@angular/router'
  );

  const withDisabledInitialNavigationImportNode = tsquery.query(
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

function processFileWithNgModuleSetup(tree: Tree, filePath: string) {
  const sourceFile = tsquery.ast(tree.read(filePath, 'utf-8'));

  const routerModuleForRootCallExpression =
    getRouterModuleForRootCallExpression(sourceFile);
  if (!routerModuleForRootCallExpression) {
    return;
  }

  const recorder = new FileChangeRecorder(tree, filePath);
  const [routes, routerOptions] = routerModuleForRootCallExpression.arguments;
  if (!routerOptions) {
    recorder.insertLeft(
      routes.getEnd(),
      `, { ${INITIAL_NAVIGATION_PROPERTY} }`
    );
  } else if (ts.isObjectLiteralExpression(routerOptions)) {
    spliceListElements(
      recorder,
      routerOptions.properties,
      routerOptions.getEnd() - 1,
      (property) =>
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === 'initialNavigation',
      INITIAL_NAVIGATION_PROPERTY
    );
  } else {
    recorder.replace(
      routerOptions,
      `{ ${getSpreadOptions(routerOptions)}${INITIAL_NAVIGATION_PROPERTY} }`
    );
  }
  recorder.applyChanges();
}

function isCallTo(node: Node, name: string): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === name
  );
}

// `?? {}` lets a value typed `undefined` be spread (TS2698). Other expressions
// aren't spread, since TypeScript rejects `??` after some of them (TS2869).
function getSpreadOptions(optionsArgument: Expression): string {
  const value = skipWrappers(optionsArgument);
  if (
    !(ts.isIdentifier(value) && value.text !== 'undefined') &&
    !ts.isPropertyAccessExpression(value) &&
    !ts.isElementAccessExpression(value) &&
    !ts.isCallExpression(value)
  ) {
    return '';
  }
  let operand = optionsArgument;
  while (ts.isParenthesizedExpression(operand)) {
    operand = operand.expression;
  }
  const operandText =
    ts.isAsExpression(operand) || ts.isSatisfiesExpression(operand)
      ? `(${operand.getText()})`
      : operand.getText();
  return `...(${operandText} ?? {}), `;
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
  const routerModuleForRootCalls = tsquery.query(
    sourceFile,
    'PropertyAssignment:has(Identifier[name=providers]) > ArrayLiteralExpression CallExpression:has(Identifier[name=provideRouter])'
  ) as CallExpression[];

  return routerModuleForRootCalls.length ? routerModuleForRootCalls[0] : null;
}

function getRouterModuleForRootCallExpression(
  sourceFile: SourceFile
): CallExpression | null {
  const routerModuleForRootCalls = tsquery.query(
    sourceFile,
    'Decorator > CallExpression:has(Identifier[name=NgModule]) PropertyAssignment:has(Identifier[name=imports]) > ArrayLiteralExpression CallExpression:has(Identifier[name=forRoot])'
  ) as CallExpression[];

  return routerModuleForRootCalls.length ? routerModuleForRootCalls[0] : null;
}
