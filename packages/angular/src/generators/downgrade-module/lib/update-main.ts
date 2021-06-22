import type { Tree } from '@nrwl/devkit';
import { generateFiles, joinPathFragments } from '@nrwl/devkit';
import { dirname } from 'path';
import { readBootstrapInfo } from '../../../utils/nx-devkit/ast-utils';
import type { DowngradeModuleGeneratorOptions } from '../schema';

export function updateMain(
  tree: Tree,
  options: DowngradeModuleGeneratorOptions
): void {
  const {
    mainPath,
    moduleClassName,
    moduleSpec,
    bootstrapComponentClassName,
    bootstrapComponentFileName,
  } = readBootstrapInfo(tree, options.project);

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files'),
    dirname(mainPath),
    {
      angularJsImport: options.angularJsImport,
      bootstrapComponentClassName,
      bootstrapComponentFileName,
      moduleClassName,
      moduleSpec,
      name: options.name,
      tmpl: '',
    }
  );
}
