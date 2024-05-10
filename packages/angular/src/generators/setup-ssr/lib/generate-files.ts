import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import type { Schema } from '../schema';

export function generateSSRFiles(
  tree: Tree,
  schema: Schema,
  isUsingApplicationBuilder: boolean
) {
  const { root: projectRoot, targets } = readProjectConfiguration(
    tree,
    schema.project
  );

  if (
    targets.server ||
    (isUsingApplicationBuilder && targets.build.options?.server !== undefined)
  ) {
    // server has already been added
    return;
  }

  const pathToFiles = joinPathFragments(__dirname, '..', 'files');

  if (schema.standalone) {
    generateFiles(
      tree,
      joinPathFragments(pathToFiles, 'standalone'),
      projectRoot,
      { ...schema, tpl: '' }
    );
  } else {
    generateFiles(
      tree,
      joinPathFragments(pathToFiles, 'ngmodule'),
      projectRoot,
      { ...schema, tpl: '' }
    );
  }
}
