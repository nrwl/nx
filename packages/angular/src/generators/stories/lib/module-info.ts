import type { Tree } from '@nrwl/devkit';
import { logger, stripIndents, visitNotIgnoredFiles } from '@nrwl/devkit';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript';
import type {
  ClassDeclaration,
  Node,
  SourceFile,
  VariableDeclaration,
} from 'typescript';
import { SyntaxKind } from 'typescript';
import { getDecoratorMetadata } from '../../../utils/nx-devkit/ast-utils';

export function getModuleDeclaredComponents(
  file: SourceFile,
  moduleFilePath: string,
  projectName: string
): string[] {
  const ngModuleDecorator = getNgModuleDecorator(file, moduleFilePath);
  const declarationsPropertyAssignment =
    getNgModuleDeclarationsPropertyAssignment(
      ngModuleDecorator,
      moduleFilePath,
      projectName
    );

  if (!declarationsPropertyAssignment) {
    return [];
  }

  const declarationsArray = getDeclarationsArray(
    file,
    declarationsPropertyAssignment,
    moduleFilePath,
    projectName
  );

  if (!declarationsArray) {
    return [];
  }

  return getDeclaredComponentsInDeclarations(declarationsArray);
}

export function getModuleFilePaths(tree: Tree, projectPath: string): string[] {
  let moduleFilePaths = [] as string[];

  visitNotIgnoredFiles(tree, projectPath, (filePath: string) => {
    if (filePath.endsWith('.module.ts')) {
      moduleFilePaths.push(filePath);
    }
  });

  return moduleFilePaths;
}

function getDeclaredComponentsInDeclarations(
  declarationsArray: Node
): string[] {
  return getDeclaredComponentNodes(declarationsArray)
    .map((node) => node.getText())
    .filter((name) => name.endsWith('Component'));
}

function getDeclaredComponentNodes(declarationsArray: Node): Node[] {
  const cmps = declarationsArray
    .getChildren()
    .find((node) => node.kind === SyntaxKind.SyntaxList)
    .getChildren()
    .map((node) => {
      if (node.kind === SyntaxKind.Identifier) {
        return node;
      }
      // if the node is a destructuring, follow the variable
      if (node.kind === SyntaxKind.SpreadElement) {
        const declarationVariableNode = node
          .getChildren()
          .find((node) => node.kind === SyntaxKind.Identifier);

        // try to find the variable declaration in the same component
        const declarationVariable = getVariableDeclaration(
          declarationVariableNode.getText(),
          declarationVariableNode.getSourceFile()
        );
        if (
          declarationVariable &&
          declarationVariable.initializer.kind ===
            SyntaxKind.ArrayLiteralExpression
        ) {
          const nodes = getDeclaredComponentNodes(
            declarationVariable.initializer
          );
          return nodes;
        }
      }
      return null;
    })
    .filter((node) => !!node);

  return flatten(cmps);
}

function flatten(arr) {
  let flattened = [];

  for (const entry of arr) {
    if (Array.isArray(entry)) {
      flattened.push(...flatten(entry));
    } else {
      flattened.push(entry);
    }
  }

  return flattened;
}

function getDeclarationsArray(
  file: SourceFile,
  declarationsPropertyAssignment: Node,
  moduleFilePath: string,
  projectName: string
): Node | undefined {
  let declarationArray = declarationsPropertyAssignment
    .getChildren()
    .find((node) => node.kind === SyntaxKind.ArrayLiteralExpression);

  if (declarationArray) {
    return declarationArray;
  }

  // Attempt to follow a variable instead of the literal
  declarationArray = getModuleDeclaredComponentsFromVariable(
    file,
    declarationsPropertyAssignment
  );

  if (declarationArray) {
    return declarationArray;
  }

  // Attempt to follow a class declaration instead of the literal
  declarationArray = getModuleDeclaredComponentsFromClass(
    file,
    declarationsPropertyAssignment
  );

  if (!declarationArray) {
    logger.warn(
      stripIndents`No stories generated because the declarations in ${moduleFilePath} is not an array literal or the variable could not be found. Hint: you can always generate stories later with the 'nx generate @nrwl/angular:stories --name=${projectName}' command.`
    );
  }

  return declarationArray;
}

/**
 * Try to get declared components like `declarations: someComponentsArrayConst`
 */
function getModuleDeclaredComponentsFromVariable(
  file: SourceFile,
  declarationsPropertyAssignment: Node
): Node | undefined {
  let declarationsVariable = declarationsPropertyAssignment
    .getChildren()
    .filter((node) => node.kind === SyntaxKind.Identifier)[1];

  if (!declarationsVariable) {
    return undefined;
  }

  // Attempt to find variable declaration in the file
  let variableDeclaration = getVariableDeclaration(
    declarationsVariable.getText(),
    file
  );

  if (!variableDeclaration) {
    return undefined;
  }

  const declarationArray = variableDeclaration
    .getChildren()
    .find((node) => node.kind === SyntaxKind.ArrayLiteralExpression);

  return declarationArray;
}

/**
 * Try to get declared components like `declarations: SomeClass.components` as in
 * https://github.com/nrwl/nx/issues/7276.
 */
function getModuleDeclaredComponentsFromClass(
  file: SourceFile,
  declarationsPropertyAssignment: Node
): Node | undefined {
  const propertyAccessExpression = declarationsPropertyAssignment
    .getChildren()
    .filter((node) => node.kind === SyntaxKind.PropertyAccessExpression)[0];

  if (!propertyAccessExpression) {
    return undefined;
  }

  // Should contain 2 identifiers [SomeClass, components]
  const [clazz, componentsProperty] = propertyAccessExpression
    .getChildren()
    .filter((node) => node.kind === SyntaxKind.Identifier);

  if (!clazz || !componentsProperty) {
    return undefined;
  }

  // Attempt to find class declaration in the file
  let classDeclaration = getClassDeclaration(clazz.getText(), file);

  if (!classDeclaration) {
    return undefined;
  }

  const declarationArray = classDeclaration.members
    .filter((node) => node.kind === SyntaxKind.PropertyDeclaration)
    .find((propertyDeclaration) =>
      propertyDeclaration
        .getChildren()
        .find(
          (node) =>
            node.kind === SyntaxKind.Identifier &&
            node.getText() === componentsProperty.getText()
        )
    )
    .getChildren()
    .find((node) => node.kind === SyntaxKind.ArrayLiteralExpression);

  return declarationArray;
}

function getClassDeclaration(
  className: string,
  file: SourceFile
): ClassDeclaration | undefined {
  const classDeclaration = findNodes(file, SyntaxKind.ClassDeclaration).find(
    (classDeclaration) =>
      classDeclaration
        .getChildren()
        .find(
          (node) =>
            node.kind === SyntaxKind.Identifier && node.getText() === className
        )
  ) as ClassDeclaration;

  return classDeclaration;
}

function getVariableDeclaration(
  variableName: string,
  file: SourceFile
): VariableDeclaration | undefined {
  const variableDeclaration = findNodes(
    file,
    SyntaxKind.VariableDeclaration
  ).find((variableDeclaration) =>
    variableDeclaration
      .getChildren()
      .find(
        (node) =>
          node.kind === SyntaxKind.Identifier && node.getText() === variableName
      )
  ) as VariableDeclaration;

  return variableDeclaration;
}

function getNgModuleDeclarationsPropertyAssignment(
  ngModuleDecorator: Node,
  moduleFilePath: string,
  projectName: string
): Node | undefined {
  const syntaxList = ngModuleDecorator.getChildren().find((node) => {
    return node.kind === SyntaxKind.SyntaxList;
  });
  const declarationsPropertyAssignment = syntaxList
    .getChildren()
    .find((node) => {
      return (
        node.kind === SyntaxKind.PropertyAssignment &&
        node.getChildren()[0].getText() === 'declarations'
      );
    });

  if (!declarationsPropertyAssignment) {
    logger.warn(
      stripIndents`No stories generated because there were no components declared in ${moduleFilePath}. Hint: you can always generate stories later with the 'nx generate @nrwl/angular:stories --name=${projectName}' command.`
    );
  }

  return declarationsPropertyAssignment;
}

function getNgModuleDecorator(file: SourceFile, moduleFilePath: string): Node {
  const ngModuleDecorators = getDecoratorMetadata(
    file,
    'NgModule',
    '@angular/core'
  );

  if (ngModuleDecorators.length === 0) {
    throw new Error(`No @NgModule decorator in ${moduleFilePath}.`);
  }

  return ngModuleDecorators[0];
}
