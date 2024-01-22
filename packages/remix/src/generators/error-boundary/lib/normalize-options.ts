import { type Tree } from '@nx/devkit';
import { resolveRemixRouteFile } from '../../../utils/remix-route-utils';
import type { ErrorBoundarySchema } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  schema: ErrorBoundarySchema
): Promise<ErrorBoundarySchema> {
  const pathToRouteFile =
    schema.nameAndDirectoryFormat === 'as-provided'
      ? schema.path
      : await resolveRemixRouteFile(tree, schema.path, schema.project);

  if (!tree.exists(pathToRouteFile)) {
    throw new Error(
      `Route file specified does not exist "${pathToRouteFile}". Please ensure you pass a correct path to the file.`
    );
  }

  return {
    ...schema,
    path: pathToRouteFile,
  };
}
