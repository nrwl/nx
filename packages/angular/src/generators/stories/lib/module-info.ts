import type { Tree } from '@nrwl/devkit';
import { logger, stripIndents, visitNotIgnoredFiles } from '@nrwl/devkit';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript';
import type { Node, SourceFile } from 'typescript';
import { SyntaxKind } from 'typescript';
import { getDecoratorMetadata } from '../../../utils/nx-devkit/ast-utils';

export function getModuleDeclaredComponents(
  file: SourceFile,
  moduleFilePath: string,
  projectName: string
): string[] {
  const ngModuleDecorator = getNgModuleDecorator(file, moduleFilePath);
  const declarationsPropertyAssignment = getNgModuleDeclarationsPropertyAssignment(
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
  return declarationsArray
    .getChildren()
    .find((node) => node.kind === SyntaxKind.SyntaxList)
    .getChildren()
    .filter((node) => node.kind === SyntaxKind.Identifier)
    .map((node) => node.getText())
    .filter((name) => name.endsWith('Component'));
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

  if (!declarationArray) {
    // Attempt to follow a variable instead of the literal
    const declarationVariable = declarationsPropertyAssignment
      .getChildren()
      .filter((node) => node.kind === SyntaxKind.Identifier)[1];
    const variableName = declarationVariable.getText();
    const variableDeclaration = findNodes(
      file,
      SyntaxKind.VariableDeclaration
    ).find((variableDeclaration) => {
      const identifier = variableDeclaration
        .getChildren()
        .find((node) => node.kind === SyntaxKind.Identifier);
      return identifier.getText() === variableName;
    });

    if (variableDeclaration) {
      declarationArray = variableDeclaration
        .getChildren()
        .find((node) => node.kind === SyntaxKind.ArrayLiteralExpression);
    } else {
      logger.warn(
        stripIndents`No stories generated because the declaration in ${moduleFilePath} is not an array literal or the variable could not be found. Hint: you can always generate stories later with the 'nx generate @nrwl/angular:stories --name=${projectName}' command.`
      );
    }
  }

  return declarationArray;
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
