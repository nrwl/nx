import { ProjectConfiguration, Tree } from '@nx/devkit';
import type { NormalizedSchema, Schema } from '../schema';
import {
  getDestination,
  getNewProjectName,
  normalizePathSlashes,
} from './utils';
import { getImportPath } from '../../../utilities/get-import-path';

export function normalizeSchema(
  tree: Tree,
  schema: Schema,
  projectConfiguration: ProjectConfiguration
): NormalizedSchema {
  const destination = normalizePathSlashes(schema.destination);
  const newProjectName =
    schema.newProjectName ?? getNewProjectName(destination);

  return {
    ...schema,
    destination,
    importPath:
      schema.importPath ??
      normalizePathSlashes(getImportPath(tree, destination)),
    newProjectName,
    relativeToRootDestination: getDestination(
      tree,
      schema,
      projectConfiguration
    ),
  };
}
