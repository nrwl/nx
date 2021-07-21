import type { Tree } from '@nrwl/devkit';
import { generateFiles, joinPathFragments, names } from '@nrwl/devkit';
import { dirname } from 'path';
import { readBootstrapInfo } from '../../../utils/nx-devkit/ast-utils';
import type { UpgradeModuleGeneratorOptions } from '../schema';

export function createFiles(
  tree: Tree,
  options: UpgradeModuleGeneratorOptions
): void {
  const {
    moduleClassName,
    mainPath,
    moduleSpec,
    bootstrapComponentClassName,
    bootstrapComponentFileName,
  } = readBootstrapInfo(tree, options.project);

  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files'),
    dirname(mainPath),
    {
      ...options,
      tmpl: '',
      moduleFileName: moduleSpec,
      moduleClassName,
      angularJsModule: options.name,
      bootstrapComponentClassName,
      bootstrapComponentFileName,
      ...names(options.name),
    }
  );
}
