import {
  readProjectConfiguration,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import { insertImport } from '@nx/js';
import { tsquery } from '@phenomnomnominal/tsquery';
import type {
  CallExpression,
  ImportSpecifier,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  Printer,
  SourceFile,
} from 'typescript';
import {
  EmitHint,
  createPrinter,
  factory,
  isCallExpression,
  isIdentifier,
  isPropertyAssignment,
} from 'typescript';
import type { Schema } from '../schema';

export function setRouterInitialNavigation(tree: Tree, options: Schema): void {
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

  const withDisabledInitialNavigationImportNode = tsquery<ImportSpecifier>(
    sourceFile,
    'ImportDeclaration ImportSpecifier:has(Identifier[name=withDisabledInitialNavigation])'
  )[0];
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

function getProvideRouterCallExpression(
  sourceFile: SourceFile
): CallExpression | null {
  const routerModuleForRootCalls = tsquery(
    sourceFile,
    'PropertyAssignment:has(Identifier[name=providers]) > ArrayLiteralExpression CallExpression:has(Identifier[name=provideRouter])',
    { visitAllChildren: true }
  ) as CallExpression[];

  return routerModuleForRootCalls.length ? routerModuleForRootCalls[0] : null;
}

function getRouterModuleForRootCallExpression(
  sourceFile: SourceFile
): CallExpression | null {
  const routerModuleForRootCalls = tsquery(
    sourceFile,
    'Decorator > CallExpression:has(Identifier[name=NgModule]) PropertyAssignment:has(Identifier[name=imports]) > ArrayLiteralExpression CallExpression:has(Identifier[name=forRoot])',
    { visitAllChildren: true }
  ) as CallExpression[];

  return routerModuleForRootCalls.length ? routerModuleForRootCalls[0] : null;
}
