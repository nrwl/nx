import type { Tree } from '@nrwl/devkit';
import { names } from '@nrwl/devkit';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';
import {
  addDeclarationToModule,
  addEntryComponents,
  addImportToModule,
  getBootstrapComponent,
  readBootstrapInfo,
} from '../../../utils/nx-devkit/ast-utils';
import type { UpgradeModuleGeneratorOptions } from '../schema';

export function addImportsToModule(
  tree: Tree,
  options: UpgradeModuleGeneratorOptions
): void {
  let { moduleClassName, modulePath, moduleSource } = readBootstrapInfo(
    tree,
    options.project
  );
  const { className, fileName } = names(options.name);

  moduleSource = insertImport(
    tree,
    moduleSource,
    modulePath,
    `configure${className}, upgradedComponents`,
    `../${fileName}-setup`
  );
  moduleSource = insertImport(
    tree,
    moduleSource,
    modulePath,
    'UpgradeModule',
    '@angular/upgrade/static'
  );
  moduleSource = addImportToModule(
    tree,
    moduleSource,
    modulePath,
    'UpgradeModule'
  );
  moduleSource = addDeclarationToModule(
    tree,
    moduleSource,
    modulePath,
    '...upgradedComponents'
  );
  addEntryComponents(
    tree,
    moduleSource,
    modulePath,
    getBootstrapComponent(moduleSource, moduleClassName)
  );
}
