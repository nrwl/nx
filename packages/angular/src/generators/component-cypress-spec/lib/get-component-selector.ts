import type { Tree } from '@nrwl/devkit';
import { findNodes } from '@nrwl/workspace/src/utilities/typescript';
import type { PropertyAssignment } from 'typescript';
import { SyntaxKind } from 'typescript';
import {
  getDecoratorMetadata,
  getTsSourceFile,
} from '../../../utils/nx-devkit/ast-utils';

export function getComponentSelector(tree: Tree, path: string): string {
  const file = getTsSourceFile(tree, path);

  const componentDecorators = getDecoratorMetadata(
    file,
    'Component',
    '@angular/core'
  );
  if (componentDecorators.length === 0) {
    throw new Error(`No @Component decorator in ${path}.`);
  }
  const componentDecorator = componentDecorators[0];
  const selectorNode = <PropertyAssignment>(
    findNodes(componentDecorator, SyntaxKind.PropertyAssignment).find(
      (node: PropertyAssignment) => node.name.getText() === 'selector'
    )
  );
  if (!selectorNode) {
    throw new Error(`No selector defined for the component in ${path}.`);
  }

  return selectorNode.initializer.getText().slice(1, -1);
}
