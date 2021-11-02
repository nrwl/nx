import { applyChangesToString, ChangeType, Tree } from '@nrwl/devkit';
import {
  __String,
  CallExpression,
  createSourceFile,
  ImportDeclaration,
  isArrayLiteralExpression,
  isCallExpression,
  isClassDeclaration,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isObjectLiteralExpression,
  isPropertyAssignment,
  ObjectLiteralExpression,
  PropertyAssignment,
  ScriptTarget,
  SourceFile,
} from 'typescript';

export function insertNgModuleImport(
  tree: Tree,
  modulePath: string,
  importName: string
) {
  const contents = tree.read(modulePath).toString('utf-8');

  const sourceFile = createSourceFile(
    modulePath,
    contents,
    ScriptTarget.ESNext
  );

  const coreImport = findImport(sourceFile, '@angular/core');

  if (!coreImport) {
    throw new Error(
      `There are no imports from "@angular/core" in ${modulePath}.`
    );
  }

  const ngModuleNamedImport = getNamedImport(coreImport, 'NgModule');

  const ngModuleName = ngModuleNamedImport.name.escapedText;

  const ngModuleClassDeclaration = findDecoratedClass(sourceFile, ngModuleName);

  const ngModuleDecorator = ngModuleClassDeclaration.decorators.find(
    (decorator) =>
      isCallExpression(decorator.expression) &&
      isIdentifier(decorator.expression.expression) &&
      decorator.expression.expression.escapedText === ngModuleName
  );

  const ngModuleCall = ngModuleDecorator.expression as CallExpression;

  if (ngModuleCall.arguments.length < 1) {
    const newContents = applyChangesToString(contents, [
      {
        type: ChangeType.Insert,
        index: ngModuleCall.getEnd() - 1,
        text: `{ imports: [${importName}]}`,
      },
    ]);
    tree.write(modulePath, newContents);
  } else {
    if (!isObjectLiteralExpression(ngModuleCall.arguments[0])) {
      throw new Error(
        `The NgModule options for ${ngModuleClassDeclaration.name.escapedText} in ${modulePath} is not an object literal`
      );
    }

    const ngModuleOptions = ngModuleCall
      .arguments[0] as ObjectLiteralExpression;

    const importsProperty = findPropertyAssignment(ngModuleOptions);

    if (!importsProperty) {
      let text = `imports: [${importName}]`;
      if (ngModuleOptions.properties.hasTrailingComma) {
        text = `${text},`;
      } else {
        text = `, ${text}`;
      }
      const newContents = applyChangesToString(contents, [
        {
          type: ChangeType.Insert,
          index: ngModuleOptions.getEnd() - 1,
          text,
        },
      ]);
      tree.write(modulePath, newContents);
    } else {
      if (!isArrayLiteralExpression(importsProperty.initializer)) {
        throw new Error(
          `The NgModule imports for ${ngModuleClassDeclaration.name.escapedText} in ${modulePath} is not an array literal`
        );
      }

      let text: string;
      if (importsProperty.initializer.elements.hasTrailingComma) {
        text = `${importName},`;
      } else {
        text = `, ${importName}`;
      }
      const newContents = applyChangesToString(contents, [
        {
          type: ChangeType.Insert,
          index: importsProperty.initializer.getEnd() - 1,
          text,
        },
      ]);
      tree.write(modulePath, newContents);
    }
  }
}

function findImport(sourceFile: SourceFile, importPath: string) {
  const importStatements = sourceFile.statements.filter(isImportDeclaration);

  return importStatements.find(
    (statement) =>
      statement.moduleSpecifier
        .getText(sourceFile)
        .replace(/['"`]/g, '')
        .trim() === importPath
  );
}

function getNamedImport(coreImport: ImportDeclaration, importName: string) {
  if (!isNamedImports(coreImport.importClause.namedBindings)) {
    throw new Error(
      `The import from ${coreImport.moduleSpecifier} does not have named imports.`
    );
  }

  return coreImport.importClause.namedBindings.elements.find((namedImport) =>
    namedImport.propertyName
      ? isIdentifier(namedImport.propertyName) &&
        namedImport.propertyName.escapedText === importName
      : isIdentifier(namedImport.name) &&
        namedImport.name.escapedText === importName
  );
}

function findDecoratedClass(sourceFile: SourceFile, ngModuleName: __String) {
  const classDeclarations = sourceFile.statements.filter(isClassDeclaration);
  return classDeclarations.find(
    (declaration) =>
      declaration.decorators &&
      declaration.decorators.some(
        (decorator) =>
          isCallExpression(decorator.expression) &&
          isIdentifier(decorator.expression.expression) &&
          decorator.expression.expression.escapedText === ngModuleName
      )
  );
}

function findPropertyAssignment(ngModuleOptions: ObjectLiteralExpression) {
  return ngModuleOptions.properties.find(
    (property) =>
      isPropertyAssignment(property) &&
      isIdentifier(property.name) &&
      property.name.escapedText === 'imports'
  ) as PropertyAssignment;
}
