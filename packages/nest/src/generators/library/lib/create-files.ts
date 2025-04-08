import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  names,
  offsetFromRoot,
} from '@nx/devkit';
import type { NormalizedOptions } from '../schema';

export function createFiles(tree: Tree, options: NormalizedOptions): void {
  const substitutions = {
    ...names(options.projectName),
    ...options,
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    fileName: options.fileName,
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
