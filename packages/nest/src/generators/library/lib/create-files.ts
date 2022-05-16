import type { Tree } from '@nrwl/devkit';
import {
  generateFiles,
  joinPathFragments,
  names,
  offsetFromRoot,
} from '@nrwl/devkit';
import type { NormalizedOptions } from '../schema';

export function createFiles(tree: Tree, options: NormalizedOptions): void {
  const substitutions = {
    ...options,
    ...names(options.moduleName),
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
  };
  generateFiles(
    tree,
    joinPathFragments(__dirname, '..', 'files', 'common'),
    options.projectRoot,
    substitutions
  );

  if (options.controller) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '..', 'files', 'controller'),
      options.projectRoot,
      substitutions
    );

    if (options.unitTestRunner === 'none') {
      tree.delete(
        joinPathFragments(
          options.projectRoot,
          'src',
          'lib',
          `${substitutions.fileName}.controller.spec.ts`
        )
      );
    }
  }

  if (options.service) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '..', 'files', 'service'),
      options.projectRoot,
      substitutions
    );

    if (options.unitTestRunner === 'none') {
      tree.delete(
        joinPathFragments(
          options.projectRoot,
          'src',
          'lib',
          `${substitutions.fileName}.service.spec.ts`
        )
      );
    }
  }
}
