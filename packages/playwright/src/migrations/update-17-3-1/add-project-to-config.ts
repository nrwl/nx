import { Tree, getProjects, joinPathFragments } from '@nx/devkit';
import * as ts from 'typescript';
import { tsquery } from '@phenomnomnominal/tsquery';

export default async function update(tree: Tree) {
  const projects = getProjects(tree);
  projects.forEach((project) => {
    // Check if the project contains playwright config
    const configPath = joinPathFragments(project.root, 'playwright.config.ts');
    if (tree.exists(configPath)) {
      addProjectIfExists(tree, joinPathFragments(configPath));
    }
  });
}

function addProjectIfExists(tree: Tree, configFilePath: string) {
  const configFileContent = tree.read(configFilePath, 'utf-8');

  const sourceFile = tsquery.ast(configFileContent);
  const printer = ts.createPrinter();

  const updatedStatements = updateOrCreateImportStatement(
    sourceFile,
    '@playwright/test',
    ['devices']
  );

  const exportAssignment = tsquery.query(
    sourceFile,
    'ExportAssignment'
  )[0] as ts.ExportAssignment;
  if (!exportAssignment) {
    // No export found in the file
    return;
  }

  const exportAssignemntObject = exportAssignment.expression;
  if (
    !(
      ts.isCallExpression(exportAssignemntObject) &&
      exportAssignemntObject.getText(sourceFile).startsWith('defineConfig') &&
      exportAssignemntObject.arguments.length > 0
    )
  ) {
    // Export is not a call expression with defineConfig ex. export default defineConfig({ ... })
    return;
  }
  let firstArgument = exportAssignemntObject.arguments[0];
  if (!ts.isObjectLiteralExpression(firstArgument)) {
    // First argument is not an object literal ex. defineConfig('foo')
    return;
  }
  const projectProperty = tsquery.query(
    exportAssignemntObject,
    'PropertyAssignment > Identifier[name="projects"]'
  )[0] as ts.PropertyAssignment;
  if (projectProperty) {
    // Projects property already exists in the config
    return;
  }

  // Add projects property to the config
  const projectsArray = ts.factory.createArrayLiteralExpression(
    [
      createProperty('chromium', 'Desktop Chrome'),
      createProperty('firefox', 'Desktop Firefox'),
      createProperty('webkit', 'Desktop Safari'),
    ],
    true
  );

  const newProjectsProperty = ts.factory.createPropertyAssignment(
    'projects',
    projectsArray
  );

  const newObj = ts.factory.createObjectLiteralExpression([
    ...firstArgument.properties,
    newProjectsProperty,
  ]);

  const newCallExpression = ts.factory.updateCallExpression(
    exportAssignemntObject,
    exportAssignemntObject.expression,
    exportAssignemntObject.typeArguments,
    [newObj]
  );

  const newExportAssignment = ts.factory.updateExportAssignment(
    exportAssignment,
    exportAssignment.modifiers,
    newCallExpression
  );

  const transformedStatements = updatedStatements.map((statement) => {
    return statement === exportAssignment ? newExportAssignment : statement;
  }) as ts.Statement[];

  const transformedSourceFile = ts.factory.updateSourceFile(
    sourceFile,
    transformedStatements
  );

  const updatedConfigFileContent = printer.printFile(transformedSourceFile);
  tree.write(configFilePath, updatedConfigFileContent);
}

function createProperty(name: string, device: string) {
  return ts.factory.createObjectLiteralExpression([
    ts.factory.createPropertyAssignment(
      'name',
      ts.factory.createStringLiteral(name)
    ),
    ts.factory.createPropertyAssignment(
      'use',
      ts.factory.createObjectLiteralExpression([
        ts.factory.createSpreadAssignment(
          ts.factory.createElementAccessExpression(
            ts.factory.createIdentifier('devices'),
            ts.factory.createStringLiteral(device)
          )
        ),
      ])
    ),
  ]);
}

function updateOrCreateImportStatement(
  sourceFile: ts.SourceFile,
  moduleName: string,
  importNames: string[]
): ts.Statement[] {
  let importDeclarationFound = false;
  const newStatements = sourceFile.statements.map((statement) => {
    if (
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier.getText(sourceFile) === `'${moduleName}'`
    ) {
      importDeclarationFound = true;
      const existingSpecifiers =
        statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings)
          ? statement.importClause.namedBindings.elements.map(
              (e) => e.name.text
            )
          : [];
      // Merge with new import names, avoiding duplicates
      const mergedImportNames = Array.from(
        new Set([...existingSpecifiers, ...importNames])
      );

      // Create new import specifiers
      const importSpecifiers = mergedImportNames.map((name) =>
        ts.factory.createImportSpecifier(
          false,
          undefined,
          ts.factory.createIdentifier(name)
        )
      );

      return ts.factory.updateImportDeclaration(
        statement,
        statement.modifiers,
        ts.factory.createImportClause(
          false,
          undefined,
          ts.factory.createNamedImports(importSpecifiers)
        ),
        statement.moduleSpecifier,
        undefined
      );
    }
    return statement;
  });

  if (!importDeclarationFound) {
    const importDeclaration = ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        false,
        undefined,
        ts.factory.createNamedImports(
          importNames.map((name) =>
            ts.factory.createImportSpecifier(
              false,
              undefined,
              ts.factory.createIdentifier(name)
            )
          )
        )
      ),
      ts.factory.createStringLiteral(moduleName)
    );
    newStatements.push(importDeclaration);
  }

  return newStatements;
}
