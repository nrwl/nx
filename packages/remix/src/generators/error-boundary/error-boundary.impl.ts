import { formatFiles, type Tree } from '@nx/devkit';
import { addV2ErrorBoundary, normalizeOptions } from './lib';
import type { ErrorBoundarySchema } from './schema';

export default async function errorBoundaryGenerator(
  tree: Tree,
  schema: ErrorBoundarySchema
) {
  const options = await normalizeOptions(tree, schema);

  addV2ErrorBoundary(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}
