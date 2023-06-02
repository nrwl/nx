import { ProjectConfiguration, Tree } from '@nx/devkit';
import type { NormalizedSchema, Schema } from '../schema';
import { getDestination, getNewProjectName, normalizeSlashes } from './utils';
import { getImportPath } from '../../../utilities/get-import-path';

export function normalizeSchema(
  tree: Tree,
  schema: Schema,
  projectConfiguration: ProjectConfiguration
): NormalizedSchema {
  const destination = schema.destination.startsWith('/')
    ? normalizeSlashes(schema.destination.slice(1))
    : schema.destination;
  const newProjectName =
    schema.newProjectName ?? getNewProjectName(destination);

  return {
    ...schema,
    destination,
    importPath:
      schema.importPath ?? normalizeSlashes(getImportPath(tree, destination)),
    newProjectName,
    relativeToRootDestination: getDestination(
      tree,
      schema,
      projectConfiguration
    ),
  };
}
