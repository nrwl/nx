import { convertNxGenerator, formatFiles, Tree } from '@nrwl/devkit';
import { moveGenerator } from '@nrwl/workspace';
import { updateModuleName } from './lib/update-module-name';
import { updateNgPackage } from './lib/update-ng-package';
import { Schema } from './schema';

/**
 * Moves an Angular lib/app to another folder (and renames it in the process)
 *
 * @remarks It's important to note that `updateModuleName` is done after the update
 * to the workspace, so it can't use the same tricks as the `@nrwl/workspace` rules
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

export const angularMoveSchematic = convertNxGenerator(angularMoveGenerator);
