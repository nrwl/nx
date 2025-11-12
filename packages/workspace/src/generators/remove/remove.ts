import { formatFiles, readProjectConfiguration, Tree } from '@nx/devkit';

import { checkProjectIsSafeToRemove } from './lib/check-project-is-safe-to-remove.js';
import { checkDependencies } from './lib/check-dependencies.js';
import { checkTargets } from './lib/check-targets.js';
import { removeProject } from './lib/remove-project.js';
import { updateTsconfig } from './lib/update-tsconfig.js';
import { removeProjectReferencesInConfig } from './lib/remove-project-references-in-config.js';
import { Schema } from './schema.js';
import { updateJestConfig } from './lib/update-jest-config.js';

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
