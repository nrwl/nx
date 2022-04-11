import type { Tree } from '@nrwl/devkit';
import {
  findNodes,
  getSourceNodes,
} from '@nrwl/workspace/src/utilities/typescript';
import type { PropertyDeclaration } from 'typescript';
import { SyntaxKind } from 'typescript';
import { getTsSourceFile } from '../../utils/nx-devkit/ast-utils';

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

export function getComponentProps(
  tree: Tree,
  componentPath: string,
  getArgsDefaultValueFn: (property: PropertyDeclaration) => string | undefined
): InputDescriptor[] {
  const props = getInputPropertyDeclarations(tree, componentPath).map(
    (node) => {
      const decoratorContent = findNodes(
        findNodes(node, SyntaxKind.Decorator).find((n) =>
          n.getText().startsWith('@Input')
        ),
        SyntaxKind.StringLiteral
      );
      const name = decoratorContent.length
        ? !decoratorContent[0].getText().includes('.')
          ? decoratorContent[0].getText().slice(1, -1)
          : node.name.getText()
        : node.name.getText();

      const type = getKnobType(node);
      const defaultValue = getArgsDefaultValueFn(node);

      return {
        name,
        type,
        defaultValue,
      };
    }
  );

  return props;
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
