import {
  convertNxGenerator,
  formatFiles,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';

import { checkProjectIsSafeToRemove } from './lib/check-project-is-safe-to-remove';
import { checkDependencies } from './lib/check-dependencies';
import { checkTargets } from './lib/check-targets';
import { removeProject } from './lib/remove-project';
import { updateTsconfig } from './lib/update-tsconfig';
import { removeProjectReferencesInConfig } from './lib/remove-project-references-in-config';
import { Schema } from './schema';
import { updateJestConfig } from './lib/update-jest-config';

export async function removeGenerator(tree: Tree, schema: Schema) {
  const project = readProjectConfiguration(tree, schema.projectName);
  await checkProjectIsSafeToRemove(tree, schema, project);
  await checkDependencies(tree, schema);
  await checkTargets(tree, schema);
  updateJestConfig(tree, schema, project);
  removeProjectReferencesInConfig(tree, schema);
  removeProject(tree, project);
  await updateTsconfig(tree, schema);
  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

export default removeGenerator;

export const removeSchematic = convertNxGenerator(removeGenerator);
