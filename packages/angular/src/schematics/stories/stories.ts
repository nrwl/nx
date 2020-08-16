import {
  chain,
  Rule,
  schematic,
  SchematicContext,
  SchematicsException,
  Tree,
  noop,
} from '@angular-devkit/schematics';
import { getProjectConfig } from '@nrwl/workspace';
import { SyntaxKind } from 'typescript';
import { getTsSourceFile, getDecoratorMetadata } from '../../utils/ast-utils';
import { CreateComponentSpecFileSchema } from '../component-cypress-spec/component-cypress-spec';
import { CreateComponentStoriesFileSchema } from '../component-story/component-story';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

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

    const libPath = getProjectConfig(tree, projectName).sourceRoot + '/lib';
    let moduleFilePaths = [] as string[];
    tree.getDir(libPath).visit((filePath) => {
      if (!filePath.endsWith('.module.ts')) {
        return;
      }
      moduleFilePaths.push(filePath);
    });
    return chain(
      moduleFilePaths.map((filePath) => {
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
            stripIndents`No stories generated because there were no components declared in ${filePath}. Hint: you can always generate stories later with the 'nx generate @nrwl/angular:stories --name=${projectName}' command`
          );
          return noop();
        }
        const declaredComponents = declarationsPropertyAssignment
          .getChildren()
          .find((node) => node.kind === SyntaxKind.ArrayLiteralExpression)
          .getChildren()
          .find((node) => node.kind === SyntaxKind.SyntaxList)
          .getChildren()
          .filter((node) => node.kind === SyntaxKind.Identifier)
          .map((node) => node.getText())
          .filter((name) => name.endsWith('Component'));

        const imports = file.statements.filter(
          (statement) => statement.kind === SyntaxKind.ImportDeclaration
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

        const modulePath = filePath.substr(0, filePath.lastIndexOf('/'));
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
