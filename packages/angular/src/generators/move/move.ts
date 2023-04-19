import { formatFiles, Tree } from '@nx/devkit';
import { moveGenerator } from '@nx/workspace/generators';
import { updateModuleName } from './lib/update-module-name';
import { updateNgPackage } from './lib/update-ng-package';
import { Schema } from './schema';

/**
 * Moves an Angular lib/app to another folder (and renames it in the process)
 *
 * @remarks It's important to note that `updateModuleName` is done after the update
 * to the workspace, so it can't use the same tricks as the `@nx/workspace` rules
 * to get the before and after names and paths.
 */
export async function angularMoveGenerator(
  tree: Tree,
  schema: Schema
): Promise<void> {
  await moveGenerator(tree, { ...schema, skipFormat: true });
  updateModuleName(tree, schema);
  updateNgPackage(tree, schema);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}
