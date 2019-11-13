import {
  chain,
  Rule,
  schematic,
  SchematicContext,
  SchematicsException,
  Tree
} from '@angular-devkit/schematics';
import { getProjectConfig } from '@nrwl/workspace';
import { SyntaxKind } from 'typescript';
import {
  getTsSourceFile,
  getDecoratorMetadata,
  getFirstNgModuleName
} from '../../utils/ast-utils';
import { CreateComponentSpecFileSchema } from '../component-cypress-spec/component-cypress-spec';
import { CreateComponentStoriesFileSchema } from '../component-story/component-story';

export interface StorybookStoriesSchema {
  name: string;
  generateCypressSpecs: boolean;
}

export default function(schema: StorybookStoriesSchema): Rule {
  return chain([createAllStories(schema.name, schema.generateCypressSpecs)]);
}

export function createAllStories(
  projectName: string,
  generateCypressSpecs: boolean
): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.debug('adding .storybook folder to lib');

    const libPath = getProjectConfig(tree, projectName).sourceRoot + '/lib';
    return chain(
      tree
        .getDir(libPath)
        .subfiles.filter(fileName => fileName.endsWith('.module.ts'))
        .map(fileName => {
          const filePath = libPath + '/' + fileName;
          const file = getTsSourceFile(tree, filePath);

          const ngModuleDecorators = getDecoratorMetadata(
            file,
            'NgModule',
            '@angular/core'
          );
          if (ngModuleDecorators.length === 0) {
            throw new SchematicsException(
              `No @NgModule decorator in ${filePath}`
            );
          }
          const ngModuleDecorator = ngModuleDecorators[0];
          const syntaxList = ngModuleDecorator.getChildren().find(node => {
            return node.kind === SyntaxKind.SyntaxList;
          });
          const declarationsPropertyAssignment = syntaxList
            .getChildren()
            .find(node => {
              return (
                node.kind === SyntaxKind.PropertyAssignment &&
                node.getChildren()[0].getText() === 'declarations'
              );
            });
          if (!declarationsPropertyAssignment) {
            throw new SchematicsException(
              `No declarations array in the @NgModule decorator in ${filePath}`
            );
          }
          const declaredComponents = declarationsPropertyAssignment
            .getChildren()
            .find(node => node.kind === SyntaxKind.ArrayLiteralExpression)
            .getChildren()
            .find(node => node.kind === SyntaxKind.SyntaxList)
            .getChildren()
            .filter(node => node.kind === SyntaxKind.Identifier)
            .map(node => node.getText())
            .filter(name => name.endsWith('Component'));

          const imports = file.statements.filter(
            statement => statement.kind === SyntaxKind.ImportDeclaration
          );
          const componentInfo = declaredComponents.map(componentName => {
            try {
              const importStatement = imports.find(statement => {
                const importedIdentifiers = statement
                  .getChildren()
                  .find(node => node.kind === SyntaxKind.ImportClause)
                  .getChildren()
                  .find(node => node.kind === SyntaxKind.NamedImports)
                  .getChildren()
                  .find(node => node.kind === SyntaxKind.SyntaxList)
                  .getChildren()
                  .filter(node => node.kind === SyntaxKind.ImportSpecifier)
                  .map(node => node.getText());
                return importedIdentifiers.includes(componentName);
              });
              const fullPath = importStatement
                .getChildren()
                .find(node => node.kind === SyntaxKind.StringLiteral)
                .getText()
                .slice(1, -1);
              const path = fullPath.slice(0, fullPath.lastIndexOf('/'));
              const componentFileName = fullPath.slice(
                fullPath.lastIndexOf('/') + 1
              );
              return { name: componentName, path, componentFileName };
            } catch (ex) {
              context.logger.warn(
                `Could not generate a story for ${componentName}.  Error: ${ex}`
              );
              return undefined;
            }
          });

          const moduleName = getFirstNgModuleName(file);

          return chain(
            componentInfo
              .filter(info => info !== undefined)
              .map(info =>
                chain([
                  schematic<CreateComponentStoriesFileSchema>(
                    'component-story',
                    {
                      libPath,
                      moduleFileName: fileName,
                      ngModuleClassName: moduleName,
                      componentName: info.name,
                      componentPath: info.path,
                      componentFileName: info.componentFileName
                    }
                  ),
                  generateCypressSpecs
                    ? schematic<CreateComponentSpecFileSchema>(
                        'component-cypress-spec',
                        {
                          projectName,
                          libPath,
                          componentName: info.name,
                          componentPath: info.path,
                          componentFileName: info.componentFileName
                        }
                      )
                    : () => {}
                ])
              )
          );
        })
    );
  };
}
