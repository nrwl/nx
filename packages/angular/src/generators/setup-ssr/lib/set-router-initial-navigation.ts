import {
  readProjectConfiguration,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import { insertImport } from '@nx/js';
import { tsquery } from '@nx/devkit/internal';
import type {
  CallExpression,
  Expression,
  ImportSpecifier,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  Printer,
  SourceFile,
  SpreadAssignment,
} from 'typescript';
import {
  EmitHint,
  SyntaxKind,
  createPrinter,
  factory,
  isAsExpression,
  isCallExpression,
  isElementAccessExpression,
  isIdentifier,
  isNonNullExpression,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isSatisfiesExpression,
} from 'typescript';
import type { NormalizedGeneratorOptions } from '../schema';

export function setRouterInitialNavigation(
  tree: Tree,
  options: NormalizedGeneratorOptions
): void {
  const printer = createPrinter();
  const project = readProjectConfiguration(tree, options.project);

  visitNotIgnoredFiles(tree, project.root, (filePath) => {
    // we are only interested in .ts files
    if (!filePath.endsWith('.ts')) {
      return;
    }

    if (options.standalone) {
      processFileWithStandaloneSetup(tree, filePath, printer);
    } else {
      processFileWithNgModuleSetup(tree, filePath, printer);
    }
  });
}

function processFileWithStandaloneSetup(
  tree: Tree,
  filePath: string,
  printer: Printer
) {
  let content = tree.read(filePath, 'utf-8');
  let sourceFile = tsquery.ast(content);

  const provideRouterCallExpression =
    getProvideRouterCallExpression(sourceFile);
  if (!provideRouterCallExpression) {
    return;
  }

  if (
    provideRouterCallExpression.arguments.some(
      (arg) =>
        isCallExpression(arg) &&
        isIdentifier(arg.expression) &&
        arg.expression.text === 'withEnabledBlockingInitialNavigation'
    )
  ) {
    return;
  }

  const updatedProvideRouterCallExpression = printer.printNode(
    EmitHint.Unspecified,
    updateProvideRouterCallExpression(provideRouterCallExpression),
    sourceFile
  );

  content = `${content.slice(
    0,
    provideRouterCallExpression.getStart()
  )}${updatedProvideRouterCallExpression}${content.slice(
    provideRouterCallExpression.getEnd()
  )}`;

  tree.write(filePath, content);

  sourceFile = tsquery.ast(content);
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

function updateProvideRouterCallExpression(
  node: CallExpression
): CallExpression {
  const filteredArgs = node.arguments.filter(
    (arg) =>
      !(
        isCallExpression(arg) &&
        isIdentifier(arg.expression) &&
        arg.expression.text === 'withDisabledInitialNavigation'
      )
  );

  const initialNavigationFeatureArg = factory.createCallExpression(
    factory.createIdentifier('withEnabledBlockingInitialNavigation'),
    [],
    []
  );

  return factory.updateCallExpression(
    node,
    node.expression,
    node.typeArguments,
    [...filteredArgs, initialNavigationFeatureArg]
  );
}

function processFileWithNgModuleSetup(
  tree: Tree,
  filePath: string,
  printer: Printer
) {
  const content = tree.read(filePath, 'utf-8');
  const sourceFile = tsquery.ast(content);

  const routerModuleForRootCallExpression =
    getRouterModuleForRootCallExpression(sourceFile);
  if (!routerModuleForRootCallExpression) {
    return;
  }

  const updatedRouterModuleForRootCallExpression = printer.printNode(
    EmitHint.Unspecified,
    updateRouterModuleForRootCallExpression(routerModuleForRootCallExpression),
    sourceFile
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
    ? factory.createNodeArray(
        existingOptions.properties.filter(
          (exp) =>
            !(
              isPropertyAssignment(exp) &&
              isIdentifier(exp.name) &&
              exp.name.text === 'initialNavigation'
            )
        )
      )
    : factory.createNodeArray<ObjectLiteralElementLike>();

  const enabledLiteral = factory.createStringLiteral('enabledBlocking', true);
  const initialNavigationProperty = factory.createPropertyAssignment(
    'initialNavigation',
    enabledLiteral
  );

  const routerOptions = existingOptions
    ? factory.updateObjectLiteralExpression(
        existingOptions,
        factory.createNodeArray([
          ...getSpreadOptions(node.arguments[1]),
          ...existingProperties,
          initialNavigationProperty,
        ])
      )
    : factory.createObjectLiteralExpression(
        factory.createNodeArray([initialNavigationProperty])
      );
  const args = [node.arguments[0], routerOptions];

  return factory.createCallExpression(
    node.expression,
    node.typeArguments,
    args
  );
}

// `?? {}` lets a value typed `undefined` be spread (TS2698). Other expressions
// aren't spread, since TypeScript rejects `??` after some of them (TS2869).
function getSpreadOptions(optionsArgument: Expression): SpreadAssignment[] {
  const value = skipWrappers(optionsArgument);
  if (
    !(isIdentifier(value) && value.text !== 'undefined') &&
    !isPropertyAccessExpression(value) &&
    !isElementAccessExpression(value) &&
    !isCallExpression(value)
  ) {
    return [];
  }
  let operand = optionsArgument;
  while (isParenthesizedExpression(operand)) {
    operand = operand.expression;
  }
  return [
    factory.createSpreadAssignment(
      factory.createParenthesizedExpression(
        factory.createBinaryExpression(
          isAsExpression(operand) || isSatisfiesExpression(operand)
            ? factory.createParenthesizedExpression(operand)
            : operand,
          SyntaxKind.QuestionQuestionToken,
          factory.createObjectLiteralExpression()
        )
      )
    ),
  ];
}

function skipWrappers(expression: Expression): Expression {
  while (
    isParenthesizedExpression(expression) ||
    isAsExpression(expression) ||
    isNonNullExpression(expression) ||
    isSatisfiesExpression(expression)
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
