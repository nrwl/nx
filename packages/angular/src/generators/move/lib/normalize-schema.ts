import type { Tree } from '@nx/devkit';
import { readProjectConfiguration } from '@nx/devkit';
import type { NormalizedSchema, Schema } from '../schema';
import { getNewProjectName } from '../../utils/get-new-project-name';

export function normalizeSchema(tree: Tree, schema: Schema): NormalizedSchema {
  const newProjectName = getNewProjectName(schema.destination);
  const { root } = readProjectConfiguration(tree, schema.projectName);

  return {
    ...schema,
    newProjectName,
    oldProjectRoot: root,
  };
}
