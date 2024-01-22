import type { Tree } from '@nx/devkit';
import {
  logger,
  normalizePath,
  stripIndents,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { findNodes } from '@nx/js';
import { extname } from 'path';
import type {
  ClassDeclaration,
  Node,
  SourceFile,
  VariableDeclaration,
} from 'typescript';
import { getDecoratorMetadata } from '../../../utils/nx-devkit/ast-utils';
import type { EntryPoint } from './entry-point';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

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

export function getModuleFilePaths(
  tree: Tree,
  entryPoint: EntryPoint
): string[] {
  let moduleFilePaths = [] as string[];

  visitNotIgnoredFiles(tree, entryPoint.path, (filePath: string) => {
    const normalizedFilePath = normalizePath(filePath);

    if (
      entryPoint.excludeDirs?.some((excludeDir) =>
        normalizedFilePath.startsWith(excludeDir)
      )
    ) {
      return;
    }

    if (
      extname(normalizedFilePath) === '.ts' &&
      !normalizedFilePath.includes('.storybook') &&
      hasNgModule(tree, normalizedFilePath)
    ) {
      moduleFilePaths.push(normalizedFilePath);
    }
  });

  return moduleFilePaths;
}

function hasNgModule(tree: Tree, filePath: string): boolean {
  ensureTypescript();
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const fileContent = tree.read(filePath, 'utf-8');
  const ast = tsquery.ast(fileContent);
  const ngModule = tsquery(
    ast,
    'ClassDeclaration > Decorator > CallExpression > Identifier[name=NgModule]',
    { visitAllChildren: true }
  );

  return ngModule.length > 0;
}

function getDeclaredComponentsInDeclarations(
  declarationsArray: Node
): string[] {
  return getDeclaredComponentNodes(declarationsArray)
    .map((node) => node.getText())
    .filter((name) => name.endsWith('Component'));
}

function getDeclaredComponentNodes(declarationsArray: Node): Node[] {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const cmps = declarationsArray
    .getChildren()
    .find((node) => node.kind === tsModule.SyntaxKind.SyntaxList)
    .getChildren()
    .map((node) => {
      if (node.kind === tsModule.SyntaxKind.Identifier) {
        return node;
      }
      // if the node is a destructuring, follow the variable
      if (node.kind === tsModule.SyntaxKind.SpreadElement) {
        const declarationVariableNode = node
          .getChildren()
          .find((node) => node.kind === tsModule.SyntaxKind.Identifier);

        // try to find the variable declaration in the same component
        const declarationVariable = getVariableDeclaration(
          declarationVariableNode.getText(),
          declarationVariableNode.getSourceFile()
        );
        if (
          declarationVariable &&
          declarationVariable.initializer.kind ===
            tsModule.SyntaxKind.ArrayLiteralExpression
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  let declarationArray = declarationsPropertyAssignment
    .getChildren()
    .find((node) => node.kind === tsModule.SyntaxKind.ArrayLiteralExpression);

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
      stripIndents`No stories generated because the declarations in ${moduleFilePath} is not an array literal or the variable could not be found. Hint: you can always generate stories later with the 'nx generate @nx/angular:stories --name=${projectName}' command.`
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  let declarationsVariable = declarationsPropertyAssignment
    .getChildren()
    .filter((node) => node.kind === tsModule.SyntaxKind.Identifier)[1];

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
    .find((node) => node.kind === tsModule.SyntaxKind.ArrayLiteralExpression);

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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const propertyAccessExpression = declarationsPropertyAssignment
    .getChildren()
    .filter(
      (node) => node.kind === tsModule.SyntaxKind.PropertyAccessExpression
    )[0];

  if (!propertyAccessExpression) {
    return undefined;
  }

  // Should contain 2 identifiers [SomeClass, components]
  const [clazz, componentsProperty] = propertyAccessExpression
    .getChildren()
    .filter((node) => node.kind === tsModule.SyntaxKind.Identifier);

  if (!clazz || !componentsProperty) {
    return undefined;
  }

  // Attempt to find class declaration in the file
  let classDeclaration = getClassDeclaration(clazz.getText(), file);

  if (!classDeclaration) {
    return undefined;
  }

  const declarationArray = classDeclaration.members
    .filter((node) => node.kind === tsModule.SyntaxKind.PropertyDeclaration)
    .find((propertyDeclaration) =>
      propertyDeclaration
        .getChildren()
        .find(
          (node) =>
            node.kind === tsModule.SyntaxKind.Identifier &&
            node.getText() === componentsProperty.getText()
        )
    )
    .getChildren()
    .find((node) => node.kind === tsModule.SyntaxKind.ArrayLiteralExpression);

  return declarationArray;
}

function getClassDeclaration(
  className: string,
  file: SourceFile
): ClassDeclaration | undefined {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const classDeclaration = findNodes(
    file,
    tsModule.SyntaxKind.ClassDeclaration
  ).find((classDeclaration) =>
    classDeclaration
      .getChildren()
      .find(
        (node) =>
          node.kind === tsModule.SyntaxKind.Identifier &&
          node.getText() === className
      )
  ) as ClassDeclaration;

  return classDeclaration;
}

function getVariableDeclaration(
  variableName: string,
  file: SourceFile
): VariableDeclaration | undefined {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const variableDeclaration = findNodes(
    file,
    tsModule.SyntaxKind.VariableDeclaration
  ).find((variableDeclaration) =>
    variableDeclaration
      .getChildren()
      .find(
        (node) =>
          node.kind === tsModule.SyntaxKind.Identifier &&
          node.getText() === variableName
      )
  ) as VariableDeclaration;

  return variableDeclaration;
}

function getNgModuleDeclarationsPropertyAssignment(
  ngModuleDecorator: Node,
  moduleFilePath: string,
  projectName: string
): Node | undefined {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const syntaxList = ngModuleDecorator.getChildren().find((node) => {
    return node.kind === tsModule.SyntaxKind.SyntaxList;
  });
  const declarationsPropertyAssignment = syntaxList
    .getChildren()
    .find((node) => {
      return (
        node.kind === tsModule.SyntaxKind.PropertyAssignment &&
        node.getChildren()[0].getText() === 'declarations'
      );
    });

  if (!declarationsPropertyAssignment) {
    logger.warn(
      stripIndents`No stories generated because there were no components declared in ${moduleFilePath}. Hint: you can always generate stories later with the 'nx generate @nx/angular:stories --name=${projectName}' command.`
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
