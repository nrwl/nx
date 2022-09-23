import { ProjectConfiguration, Tree, getWorkspaceLayout } from '@nrwl/devkit';
import { getImportPath } from 'nx/src/utils/path';
import type { NormalizedSchema, Schema } from '../schema';
import { getDestination, getNewProjectName, normalizeSlashes } from './utils';

export function normalizeSchema(
  tree: Tree,
  schema: Schema,
  projectConfiguration: ProjectConfiguration
): NormalizedSchema {
  const destination = schema.destination.startsWith('/')
    ? normalizeSlashes(schema.destination.slice(1))
    : schema.destination;
  const newProjectName = getNewProjectName(destination);
  const { npmScope } = getWorkspaceLayout(tree);

  return {
    ...schema,
    destination,
    importPath:
      schema.importPath ??
      normalizeSlashes(getImportPath(npmScope, newProjectName)),
    newProjectName,
    relativeToRootDestination: getDestination(
      tree,
      schema,
      projectConfiguration
    ),
  };
}
