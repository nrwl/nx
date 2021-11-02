import type { Tree } from '@nrwl/devkit';
import {
  addEntryComponents,
  readBootstrapInfo,
} from '../../../utils/nx-devkit/ast-utils';
import type { DowngradeModuleGeneratorOptions } from '../schema';

export function addEntryComponentsToModule(
  tree: Tree,
  options: DowngradeModuleGeneratorOptions
): void {
  const { modulePath, moduleSource, bootstrapComponentClassName } =
    readBootstrapInfo(tree, options.project);

  addEntryComponents(
    tree,
    moduleSource,
    modulePath,
    bootstrapComponentClassName
  );
}
