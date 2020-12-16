import {
  chain,
  noop,
  Rule,
  schematic,
  SchematicContext,
  SchematicsException,
  Tree,
} from '@angular-devkit/schematics';
import { SyntaxKind } from 'typescript';
import { getDecoratorMetadata, getTsSourceFile } from '../../utils/ast-utils';
import { projectRootPath } from '@nrwl/workspace/src/utils/project-type';
import { findNodes } from '@nrwl/workspace/src/utils/ast-utils';
import { CreateComponentSpecFileSchema } from '../component-cypress-spec/component-cypress-spec';
import { CreateComponentStoriesFileSchema } from '../component-story/component-story';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { join, normalize } from '@angular-devkit/core';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

export interface StorybookStoriesSchema {
  name: string;
  generateCypressSpecs: boolean;
}

export default function (schema: StorybookStoriesSchema): Rule {
  return chain([createAllStories(schema.name, schema.generateCypressSpecs)]);
}

export function createAllStories(
  projectName: string,
  generateCypressSpecs: boolean
): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.debug('adding .storybook folder to lib');

    const libPath = projectRootPath(tree, projectName);

    let moduleFilePaths = [] as string[];
    tree.getDir(libPath).visit((filePath) => {
      if (!filePath.endsWith('.module.ts')) {
        return;
      }
      moduleFilePaths.push(filePath);
    });
    return chain(
      moduleFilePaths.map((moduleFilePath) => {
        const file = getTsSourceFile(tree, moduleFilePath);

        const ngModuleDecorators = getDecoratorMetadata(
          file,
          'NgModule',
          '@angular/core'
        );
        if (ngModuleDecorators.length === 0) {
          throw new SchematicsException(
            `No @NgModule decorator in ${moduleFilePath}`
          );
        }
        const ngModuleDecorator = ngModuleDecorators[0];
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
          context.logger.warn(
            stripIndents`No stories generated because there were no components declared in ${moduleFilePath}. Hint: you can always generate stories later with the 'nx generate @nrwl/angular:stories --name=${projectName}' command`
          );
          return noop();
        }
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
            context.logger.warn(
              stripIndents`No stories generated because the declaration in ${moduleFilePath} is not an array literal or the variable could not be found. Hint: you can always generate stories later with the 'nx generate @nrwl/angular:stories --name=${projectName}' command`
            );
            return noop();
          }
        }
        const declaredComponents = declarationArray
          .getChildren()
          .find((node) => node.kind === SyntaxKind.SyntaxList)
          .getChildren()
          .filter((node) => node.kind === SyntaxKind.Identifier)
          .map((node) => node.getText())
          .filter((name) => name.endsWith('Component'));

        const imports = file.statements.filter(
          (statement) => statement.kind === SyntaxKind.ImportDeclaration
        );

        const modulePath = moduleFilePath.substr(
          0,
          moduleFilePath.lastIndexOf('/')
        );

        const componentInfo = declaredComponents.map((componentName) => {
          try {
            const importStatement = imports.find((statement) => {
              const namedImports = statement
                .getChildren()
                .find((node) => node.kind === SyntaxKind.ImportClause)
                .getChildren()
                .find((node) => node.kind === SyntaxKind.NamedImports);
              if (namedImports === undefined) return false;

              const importedIdentifiers = namedImports
                .getChildren()
                .find((node) => node.kind === SyntaxKind.SyntaxList)
                .getChildren()
                .filter((node) => node.kind === SyntaxKind.ImportSpecifier)
                .map((node) => node.getText());
              return importedIdentifiers.includes(componentName);
            });
            const fullPath = importStatement
              .getChildren()
              .find((node) => node.kind === SyntaxKind.StringLiteral)
              .getText()
              .slice(1, -1);

            // if it is a directory, search recursively for the component
            let fullCmpImportPath = moduleFilePath.slice(
              0,
              moduleFilePath.lastIndexOf('/')
            );
            if (fullCmpImportPath.startsWith('/')) {
              fullCmpImportPath = fullCmpImportPath.slice(
                1,
                fullCmpImportPath.length
              );
            }

            const componentImportPath = join(
              normalize(fullCmpImportPath),
              fullPath
            );

            const dir = tree.getDir(componentImportPath);
            if (dir && dir.subfiles.length > 0) {
              let path = null;
              let componentFileName = null;
              // search the fullPath for component declarations
              tree.getDir(componentImportPath).visit((componentFilePath) => {
                if (componentFilePath.endsWith('.ts')) {
                  const content = tree
                    .read(componentFilePath)
                    .toString('utf-8');
                  if (content.indexOf(`class ${componentName}`) > -1) {
                    path = componentFilePath
                      .slice(0, componentFilePath.lastIndexOf('/'))
                      .replace(modulePath, '.');
                    componentFileName = componentFilePath.slice(
                      componentFilePath.lastIndexOf('/') + 1,
                      componentFilePath.lastIndexOf('.')
                    );
                    return;
                  }
                }
              });

              if (path === null) {
                throw new SchematicsException(
                  `Path to component ${componentName} couldn't be found. Please open an issue on https://github.com/nrwl/nx/issues.`
                );
              }

              return { name: componentName, path, componentFileName };
            } else {
              const path = fullPath.slice(0, fullPath.lastIndexOf('/'));
              const componentFileName = fullPath.slice(
                fullPath.lastIndexOf('/') + 1
              );
              return { name: componentName, path, componentFileName };
            }
          } catch (ex) {
            context.logger.warn(
              `Could not generate a story for ${componentName}.  Error: ${ex}`
            );
            return undefined;
          }
        });

        return chain(
          componentInfo
            .filter((info) => info !== undefined)
            .map((info) =>
              chain([
                schematic<CreateComponentStoriesFileSchema>('component-story', {
                  libPath: modulePath,
                  componentName: info.name,
                  componentPath: info.path,
                  componentFileName: info.componentFileName,
                }),
                generateCypressSpecs
                  ? schematic<CreateComponentSpecFileSchema>(
                      'component-cypress-spec',
                      {
                        projectName,
                        libPath: modulePath,
                        componentName: info.name,
                        componentPath: info.path,
                        componentFileName: info.componentFileName,
                      }
                    )
                  : () => {},
              ])
            )
        );
      })
    );
  };
}
export const storiesGenerator = wrapAngularDevkitSchematic(
  '@nrwl/angular',
  'stories'
);
