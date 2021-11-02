import type { Tree } from '@nrwl/devkit';
import { names } from '@nrwl/devkit';
import {
  addMethod,
  addParameterToConstructor,
} from '@nrwl/workspace/src/utilities/ast-utils';
import {
  readBootstrapInfo,
  removeFromNgModule,
} from '../../../utils/nx-devkit/ast-utils';
import type { UpgradeModuleGeneratorOptions } from '../schema';

export function updateModuleBootstrap(
  tree: Tree,
  options: UpgradeModuleGeneratorOptions
): void {
  let { moduleClassName, modulePath, moduleSource } = readBootstrapInfo(
    tree,
    options.project
  );

  moduleSource = addParameterToConstructor(tree, moduleSource, modulePath, {
    className: moduleClassName,
    param: 'private upgrade: UpgradeModule',
  });
  moduleSource = addMethod(tree, moduleSource, modulePath, {
    className: moduleClassName,
    methodHeader: 'ngDoBootstrap(): void',
    body: `
configure${names(options.name).className}(this.upgrade.injector);
this.upgrade.bootstrap(document.body, ['downgraded', '${options.name}']);
`,
  });
  removeFromNgModule(tree, moduleSource, modulePath, 'bootstrap');
}
