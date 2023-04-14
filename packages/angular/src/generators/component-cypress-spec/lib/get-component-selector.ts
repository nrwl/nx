import type { Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { findNodes } from '@nx/js';
import type { PropertyAssignment } from 'typescript';

import {
  getDecoratorMetadata,
  getTsSourceFile,
} from '../../../utils/nx-devkit/ast-utils';

let tsModule: typeof import('typescript');

export function getComponentSelector(tree: Tree, path: string): string {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
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
    findNodes(componentDecorator, tsModule.SyntaxKind.PropertyAssignment).find(
      (node: PropertyAssignment) => node.name.getText() === 'selector'
    )
  );
  if (!selectorNode) {
    throw new Error(`No selector defined for the component in ${path}.`);
  }

  return selectorNode.initializer.getText().slice(1, -1);
}
