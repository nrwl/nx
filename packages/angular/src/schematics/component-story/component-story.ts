import {
  chain,
  move,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import { findNodes } from '@nrwl/workspace';
import { PropertyDeclaration, SyntaxKind } from 'typescript';
import { getTsSourceFile } from '../../utils/ast-utils';
import {
  getSourceNodes,
  applyWithSkipExisting,
} from '@nrwl/workspace/src/utils/ast-utils';
import { join, normalize } from '@angular-devkit/core';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

export interface CreateComponentStoriesFileSchema {
  libPath: string;
  componentName: string;
  componentPath: string;
  componentFileName: string;
}

export default function (schema: CreateComponentStoriesFileSchema): Rule {
  return chain([createComponentStoriesFile(schema)]);
}

export function createComponentStoriesFile({
  libPath,
  componentName,
  componentPath,
  componentFileName,
}: CreateComponentStoriesFileSchema): Rule {
  return (tree: Tree, context: SchematicContext): Rule => {
    const props = getInputDescriptors(
      tree,
      join(normalize(libPath), componentPath, `${componentFileName}.ts`)
    );
    return applyWithSkipExisting(url('./files'), [
      template({
        componentFileName: componentFileName,
        componentName: componentName,
        props,
        tmpl: '',
      }),
      move(libPath + '/' + componentPath),
    ]);
  };
}

export type KnobType = 'text' | 'boolean' | 'number' | 'select';
export interface InputDescriptor {
  name: string;
  type: KnobType;
  defaultValue?: string;
}

export function getInputPropertyDeclarations(
  tree: Tree,
  path: string
): PropertyDeclaration[] {
  const file = getTsSourceFile(tree, path);

  const decorators = getSourceNodes(file).filter(
    (node) => node.kind === SyntaxKind.Decorator
  );

  return decorators
    .filter((decorator) =>
      findNodes(decorator, SyntaxKind.Identifier).some(
        (node) => node.getText() === 'Input'
      )
    )
    .map((node) => node.parent as PropertyDeclaration);
}

export function getInputDescriptors(
  tree: Tree,
  path: string
): InputDescriptor[] {
  return getInputPropertyDeclarations(tree, path).map((node) => {
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
  });
}

export function getKnobType(property: PropertyDeclaration): KnobType {
  if (property.type) {
    const typeName = property.type.getText();
    const typeNameToKnobType: Record<string, KnobType> = {
      string: 'text',
      number: 'number',
      boolean: 'boolean',
    };
    return typeNameToKnobType[typeName] || 'text';
  }
  if (property.initializer) {
    const initializerKindToKnobType: Record<number, KnobType> = {
      [SyntaxKind.StringLiteral]: 'text',
      [SyntaxKind.NumericLiteral]: 'number',
      [SyntaxKind.TrueKeyword]: 'boolean',
      [SyntaxKind.FalseKeyword]: 'boolean',
    };
    return initializerKindToKnobType[property.initializer.kind] || 'text';
  }
  return 'text';
}

export function getKnobDefaultValue(property: PropertyDeclaration): string {
  const typeNameToDefault = {
    string: "''",
    number: '0',
    boolean: 'false',
  };
  return property.initializer
    ? property.initializer.getText()
    : property.type
    ? typeNameToDefault[property.type.getText()]
    : "''";
}

export const componentStoryGenerator = wrapAngularDevkitSchematic(
  '@nrwl/angular',
  'component-story'
);
