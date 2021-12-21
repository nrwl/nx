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

type ngModuleDecoratorProperty =
  | 'imports'
  | 'providers'
  | 'declarations'
  | 'exports';

export function insertNgModuleProperty(
  tree: Tree,
  modulePath: string,
  name: string,
  property: ngModuleDecoratorProperty
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
        text: `{ ${property}: [${name}]}`,
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

    const typeProperty = findPropertyAssignment(ngModuleOptions, property);

    if (!typeProperty) {
      let text = `${property}: [${name}]`;
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
      if (!isArrayLiteralExpression(typeProperty.initializer)) {
        throw new Error(
          `The NgModule ${property} for ${ngModuleClassDeclaration.name.escapedText} in ${modulePath} is not an array literal`
        );
      }

      let text: string;
      if (typeProperty.initializer.elements.hasTrailingComma) {
        text = `${name},`;
      } else {
        text = `, ${name}`;
      }
      const newContents = applyChangesToString(contents, [
        {
          type: ChangeType.Insert,
          index: typeProperty.initializer.getEnd() - 1,
          text,
        },
      ]);
      tree.write(modulePath, newContents);
    }
  }
}

export function insertNgModuleImport(
  tree: Tree,
  modulePath: string,
  importName: string
) {
  insertNgModuleProperty(tree, modulePath, importName, 'imports');
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

function findPropertyAssignment(
  ngModuleOptions: ObjectLiteralExpression,
  propertyName: ngModuleDecoratorProperty
) {
  return ngModuleOptions.properties.find(
    (property) =>
      isPropertyAssignment(property) &&
      isIdentifier(property.name) &&
      property.name.escapedText === propertyName
  ) as PropertyAssignment;
}
