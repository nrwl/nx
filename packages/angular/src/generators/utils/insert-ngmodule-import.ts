import { applyChangesToString, ChangeType, Tree } from '@nx/devkit';
import type {
  __String,
  CallExpression,
  ClassDeclaration,
  ImportDeclaration,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
} from 'typescript';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

export type ngModuleDecoratorProperty =
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const contents = tree.read(modulePath).toString('utf-8');

  const sourceFile = tsModule.createSourceFile(
    modulePath,
    contents,
    tsModule.ScriptTarget.ESNext
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

  const { getDecorators } = getTsEsLintTypeUtils();
  const ngModuleDecorator = getDecorators(ngModuleClassDeclaration).find(
    (decorator) =>
      tsModule.isCallExpression(decorator.expression) &&
      tsModule.isIdentifier(decorator.expression.expression) &&
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
    if (!tsModule.isObjectLiteralExpression(ngModuleCall.arguments[0])) {
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
      } else if (ngModuleOptions.properties.length) {
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
      if (!tsModule.isArrayLiteralExpression(typeProperty.initializer)) {
        throw new Error(
          `The NgModule ${property} for ${ngModuleClassDeclaration.name.escapedText} in ${modulePath} is not an array literal`
        );
      }

      let text: string;
      if (typeProperty.initializer.elements.hasTrailingComma) {
        text = `${name},`;
      } else if (typeProperty.initializer.elements.length) {
        text = `, ${name}`;
      } else {
        text = name;
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const importStatements = sourceFile.statements.filter(
    tsModule.isImportDeclaration
  );

  return importStatements.find(
    (statement) =>
      statement.moduleSpecifier
        .getText(sourceFile)
        .replace(/['"`]/g, '')
        .trim() === importPath
  );
}

function getNamedImport(coreImport: ImportDeclaration, importName: string) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  if (!tsModule.isNamedImports(coreImport.importClause.namedBindings)) {
    throw new Error(
      `The import from ${coreImport.moduleSpecifier} does not have named imports.`
    );
  }

  return coreImport.importClause.namedBindings.elements.find((namedImport) =>
    namedImport.propertyName
      ? tsModule.isIdentifier(namedImport.propertyName) &&
        namedImport.propertyName.escapedText === importName
      : tsModule.isIdentifier(namedImport.name) &&
        namedImport.name.escapedText === importName
  );
}

function findDecoratedClass(
  sourceFile: SourceFile,
  ngModuleName: __String
): ClassDeclaration | undefined {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const classDeclarations = sourceFile.statements.filter(
    tsModule.isClassDeclaration
  );
  const { getDecorators } = getTsEsLintTypeUtils();

  return classDeclarations.find((declaration) => {
    const decorators = getDecorators(declaration);
    if (decorators) {
      return decorators.some(
        (decorator) =>
          tsModule.isCallExpression(decorator.expression) &&
          tsModule.isIdentifier(decorator.expression.expression) &&
          decorator.expression.expression.escapedText === ngModuleName
      );
    }
    return undefined;
  });
}

function findPropertyAssignment(
  ngModuleOptions: ObjectLiteralExpression,
  propertyName: ngModuleDecoratorProperty
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  return ngModuleOptions.properties.find(
    (property) =>
      tsModule.isPropertyAssignment(property) &&
      tsModule.isIdentifier(property.name) &&
      property.name.escapedText === propertyName
  ) as PropertyAssignment;
}

let tsUtils: typeof import('@typescript-eslint/type-utils');
function getTsEsLintTypeUtils(): typeof import('@typescript-eslint/type-utils') {
  return tsUtils ?? require('@typescript-eslint/type-utils');
}
