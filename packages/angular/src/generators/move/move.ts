import { formatFiles, Tree } from '@nx/devkit';
import { moveGenerator } from '@nx/workspace/generators';
import {
  normalizeSchema,
  updateModuleName,
  updateNgPackage,
  updateSecondaryEntryPoints,
} from './lib';
import type { Schema } from './schema';

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
  const normalizedSchema = normalizeSchema(tree, schema);

  await moveGenerator(tree, { ...schema, skipFormat: true });
  updateModuleName(tree, normalizedSchema);
  updateNgPackage(tree, normalizedSchema);
  updateSecondaryEntryPoints(tree, normalizedSchema);

  if (!normalizedSchema.skipFormat) {
    await formatFiles(tree);
  }
}
