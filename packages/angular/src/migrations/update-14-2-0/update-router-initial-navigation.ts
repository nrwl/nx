import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import {
  createProjectGraphAsync,
  formatFiles,
  readProjectConfiguration,
  visitNotIgnoredFiles,
} from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import type {
  CallExpression,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
} from 'typescript';
import {
  createPrinter,
  EmitHint,
  factory,
  isIdentifier,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isStringLiteralLike,
} from 'typescript';

export default async function (tree: Tree) {
  const printer = createPrinter();
  const projects = await getProjectsWithAngularRouter(tree);

  for (const project of projects) {
    visitNotIgnoredFiles(tree, project.root, (filePath) => {
      // we are only interested in .ts files
      if (!filePath.endsWith('.ts')) {
        return;
      }

      const content = tree.read(filePath, 'utf-8');
      const ast = tsquery.ast(content);
      const routerModuleForRootCall = getRouterModuleForRootCall(ast);
      if (!routerModuleForRootCall) {
        return;
      }

      const initialNavigationAssignment = getInitialNavigationAssignment(
        routerModuleForRootCall.arguments[1] as ObjectLiteralExpression
      );
      if (!initialNavigationAssignment) {
        return;
      }

      const updatedInitialNavigationAssignment = printer.printNode(
        EmitHint.Unspecified,
        factory.updatePropertyAssignment(
          initialNavigationAssignment,
          initialNavigationAssignment.name,
          factory.createIdentifier(`'enabledBlocking'`)
        ),
        initialNavigationAssignment.getSourceFile()
      );
      const updatedContent = `${content.slice(
        0,
        initialNavigationAssignment.getStart()
      )}${updatedInitialNavigationAssignment}${content.slice(
        initialNavigationAssignment.getEnd()
      )}`;

      tree.write(filePath, updatedContent);
    });
  }

  await formatFiles(tree);
}

function getInitialNavigationAssignment(
  extraOptionsLiteral: ObjectLiteralExpression
): PropertyAssignment | null {
  for (const prop of extraOptionsLiteral.properties) {
    if (
      isPropertyAssignment(prop) &&
      (isIdentifier(prop.name) || isStringLiteralLike(prop.name)) &&
      prop.name.text === 'initialNavigation' &&
      needsMigration(prop)
    ) {
      return prop;
    }
  }

  return null;
}

async function getProjectsWithAngularRouter(
  tree: Tree
): Promise<ProjectConfiguration[]> {
  const projectGraph = await createProjectGraphAsync();

  return Object.entries(projectGraph.dependencies)
    .filter(([, dep]) =>
      dep.some(({ target }) => target === 'npm:@angular/router')
    )
    .map(([projectName]) => readProjectConfiguration(tree, projectName));
}

function getRouterModuleForRootCall(
  sourceFile: SourceFile
): CallExpression | null {
  // narrow down call expressions
  const routerModuleForRootCalls = tsquery(
    sourceFile,
    'CallExpression:has(PropertyAccessExpression:has(Identifier[name=RouterModule]):has(Identifier[name=forRoot]))',
    { visitAllChildren: true }
  ) as CallExpression[];

  for (const node of routerModuleForRootCalls) {
    if (
      isRouterModuleForRoot(node) &&
      node.arguments.length >= 2 &&
      isObjectLiteralExpression(node.arguments[1])
    ) {
      return node;
    }
  }

  return null;
}

function isRouterModuleForRoot(node: CallExpression): boolean {
  // make sure is not an outer call expression (NgModule call)
  const routerModuleForRootIdentifier = tsquery(
    node.expression,
    'CallExpression > PropertyAccessExpression > Identifier[name=RouterModule] ~ Identifier[name=forRoot]',
    { visitAllChildren: true }
  )[0];

  return !!routerModuleForRootIdentifier;
}

function needsMigration(node: PropertyAssignment): boolean {
  return (
    isStringLiteralLike(node.initializer) && node.initializer.text === 'enabled'
  );
}
