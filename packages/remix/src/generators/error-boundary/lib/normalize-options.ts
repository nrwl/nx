import { type Tree } from '@nx/devkit';
import type { ErrorBoundarySchema } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  schema: ErrorBoundarySchema
): Promise<ErrorBoundarySchema> {
  const pathToRouteFile = schema.path;

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
