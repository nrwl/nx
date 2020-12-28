import {
  chain,
  move,
  Rule,
  SchematicContext,
  SchematicsException,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import { findNodes, getProjectConfig } from '@nrwl/workspace';
import {
  PropertyAssignment,
  PropertyDeclaration,
  SyntaxKind,
} from 'typescript';
import { getDecoratorMetadata, getTsSourceFile } from '../../utils/ast-utils';
import {
  getInputPropertyDeclarations,
  getKnobType,
} from '../component-story/component-story';
import { applyWithSkipExisting } from '@nrwl/workspace/src/utils/ast-utils';
import { join, normalize } from '@angular-devkit/core';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

export default function (schema: CreateComponentSpecFileSchema): Rule {
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
  componentFileName,
}: CreateComponentSpecFileSchema): Rule {
  return (tree: Tree, context: SchematicContext): Rule => {
    const e2eLibIntegrationFolderPath =
      getProjectConfig(tree, projectName + '-e2e').sourceRoot + '/integration';
    const fullComponentPath = join(
      normalize(libPath),
      componentPath,
      `${componentFileName}.ts`
    );
    const props = getInputPropertyDeclarations(tree, fullComponentPath).map(
      (node) => {
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
          defaultValue,
        };
      }
    );
    const componentSelector = getComponentSelector(tree, fullComponentPath);
    return applyWithSkipExisting(url('./files'), [
      template({
        projectName,
        componentFileName: componentFileName,
        componentName: componentName,
        componentSelector,
        props,
        tmpl: '',
      }),
      move(e2eLibIntegrationFolderPath + '/' + componentPath),
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
export const componentCypressSpecGenerator = wrapAngularDevkitSchematic(
  '@nrwl/angular',
  'component-cypress-spec'
);
