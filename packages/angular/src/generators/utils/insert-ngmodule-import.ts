import { applyChangesToString, ChangeType, Tree } from '@nrwl/devkit';
import type {
  __String,
  CallExpression,
  ClassDeclaration,
  Decorator,
  ImportDeclaration,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
} from 'typescript';
import { ensureTypescript } from '@nrwl/js/src/utils/typescript/ensure-typescript';

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

  /**
   * Ensure backwards compatibility with TS < 4.8 due to the API change in TS4.8.
   * The getDecorators util is only in TS 4.8, so we need the previous logic to handle TS < 4.8.
   *
   * TODO: clean this up using another util or when we don't need to support TS < 4.8 anymore.
   */
  let ngModuleClassDeclaration: ClassDeclaration;
  let ngModuleDecorator: Decorator;
  try {
    ngModuleClassDeclaration = findDecoratedClass(sourceFile, ngModuleName);
    ngModuleDecorator = tsModule
      .getDecorators(ngModuleClassDeclaration)
      .find(
        (decorator) =>
          tsModule.isCallExpression(decorator.expression) &&
          tsModule.isIdentifier(decorator.expression.expression) &&
          decorator.expression.expression.escapedText === ngModuleName
      );
  } catch {
    // Support for TS < 4.8
    ngModuleClassDeclaration = findDecoratedClassLegacy(
      sourceFile,
      ngModuleName
    );
    // @ts-ignore
    ngModuleDecorator = ngModuleClassDeclaration.decorators.find(
      (decorator) =>
        tsModule.isCallExpression(decorator.expression) &&
        tsModule.isIdentifier(decorator.expression.expression) &&
        decorator.expression.expression.escapedText === ngModuleName
    );
  }

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
  return classDeclarations.find((declaration) => {
    const decorators = tsModule.getDecorators(declaration);
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

function findDecoratedClassLegacy(
  sourceFile: SourceFile,
  ngModuleName: __String
) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const classDeclarations = sourceFile.statements.filter(
    tsModule.isClassDeclaration
  );
  return classDeclarations.find(
    (declaration) =>
      declaration.decorators &&
      (declaration.decorators as any[]).some(
        (decorator) =>
          tsModule.isCallExpression(decorator.expression) &&
          tsModule.isIdentifier(decorator.expression.expression) &&
          decorator.expression.expression.escapedText === ngModuleName
      )
  );
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
