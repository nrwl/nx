import {
  chain,
  externalSchematic,
  Rule,
  Tree,
  SchematicContext,
  mergeWith,
  apply,
  url,
  template,
  move,
  SchematicsException
} from '@angular-devkit/schematics';
import {
  getSourceNodes,
  findNodes,
  getDecoratorMetadata,
  findNode
} from '@schematics/angular/utility/ast-utils';
import {
  SyntaxKind,
  PropertyDeclaration,
  PropertyAssignment
} from 'typescript';
import {
  CreateComponentStoriesFileSchema,
  getInputPropertyDeclarations,
  getKnobType
} from '../component-story/component-story';
import { getTsSourceFile } from '../../utils/utils';
import { getProject } from '@schematics/angular/utility/project';

export default function(schema: CreateComponentSpecFileSchema): Rule {
  return chain([createComponentSpecFile(schema)]);
}

export interface CreateComponentSpecFileSchema {
  projectName: string;
  libPath: string;
  componentName: string;
  componentPath: string;
  componentFileName: string;
}

export function createComponentSpecFile({
  projectName,
  libPath,
  componentName,
  componentPath,
  componentFileName
}: CreateComponentSpecFileSchema): Rule {
  return (tree: Tree, context: SchematicContext): Rule => {
    const e2eLibIntegrationFolderPath =
      getProject(tree, projectName + '-e2e').sourceRoot + '/integration';
    const fullComponentPath =
      libPath + '/' + componentPath + '/' + componentFileName + '.ts';
    const props = getInputPropertyDeclarations(tree, fullComponentPath).map(
      node => {
        const decoratorContent = findNodes(
          findNodes(node, SyntaxKind.Decorator)[0],
          SyntaxKind.StringLiteral
        );
        const name = decoratorContent.length
          ? decoratorContent[0].getText().slice(1, -1)
          : node.name.getText();

        const type = getKnobType(node);
        const defaultValue = getKnobDefaultValue(node);

        return {
          name,
          type,
          defaultValue
        };
      }
    );
    const componentSelector = getComponentSelector(tree, fullComponentPath);
    return chain([
      mergeWith(
        apply(url('./files'), [
          template({
            projectName,
            componentFileName: componentFileName,
            componentName: componentName,
            componentSelector,
            props,
            tmpl: ''
          }),
          move(e2eLibIntegrationFolderPath + '/' + componentPath)
        ])
      )
    ]);
  };
}

export function getComponentSelector(tree: Tree, path: string): string {
  const file = getTsSourceFile(tree, path);

  const componentDecorators = getDecoratorMetadata(
    file,
    'Component',
    '@angular/core'
  );
  if (componentDecorators.length === 0) {
    throw new SchematicsException(`No @NgModule decorator in ${path}`);
  }
  const componentDecorator = componentDecorators[0];
  const selectorNode = <PropertyAssignment>(
    findNodes(componentDecorator, SyntaxKind.PropertyAssignment).find(
      (node: PropertyAssignment) => node.name.getText() === 'selector'
    )
  );
  if (!selectorNode) {
    throw new SchematicsException(
      `No selector defined for the component in ${path}`
    );
  }

  return selectorNode.initializer.getText().slice(1, -1);
}

export function getKnobDefaultValue(
  property: PropertyDeclaration
): string | undefined {
  if (!property.initializer) {
    return undefined;
  }
  switch (property.initializer.kind) {
    case SyntaxKind.StringLiteral:
      return property.initializer.getText().slice(1, -1);
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.TrueKeyword:
    case SyntaxKind.FalseKeyword:
      return property.initializer.getText();
    default:
      return undefined;
  }
}
