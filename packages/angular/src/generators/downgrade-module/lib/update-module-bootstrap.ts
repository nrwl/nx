import type { Tree } from '@nrwl/devkit';
import { addMethod } from '@nrwl/workspace/src/utilities/ast-utils';
import {
  readBootstrapInfo,
  removeFromNgModule,
} from '../../../utils/nx-devkit/ast-utils';
import type { DowngradeModuleGeneratorOptions } from '../schema';

export function updateModuleBootstrap(
  tree: Tree,
  options: DowngradeModuleGeneratorOptions
): void {
  let { modulePath, moduleSource, moduleClassName } = readBootstrapInfo(
    tree,
    options.project
  );

  moduleSource = removeFromNgModule(
    tree,
    moduleSource,
    modulePath,
    'bootstrap'
  );
  addMethod(tree, moduleSource, modulePath, {
    className: moduleClassName,
    methodHeader: 'ngDoBootstrap(): void',
  });
}
