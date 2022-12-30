import {
  convertNxGenerator,
  formatFiles,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';

import { checkDestination } from './lib/check-destination';
import { moveProject } from './lib/move-project';
import { moveProjectConfiguration } from './lib/move-project-configuration';
import { normalizeSchema } from './lib/normalize-schema';
import { updateBuildTargets } from './lib/update-build-targets';
import { updateCypressConfig } from './lib/update-cypress-config';
import { updateDefaultProject } from './lib/update-default-project';
import { updateEslintrcJson } from './lib/update-eslintrc-json';
import { updateImplicitDependencies } from './lib/update-implicit-dependencies';
import { updateImports } from './lib/update-imports';
import { updateJestConfig } from './lib/update-jest-config';
import { updatePackageJson } from './lib/update-package-json';
import { updateProjectRootFiles } from './lib/update-project-root-files';
import { updateReadme } from './lib/update-readme';
import { updateStorybookConfig } from './lib/update-storybook-config';
import { Schema } from './schema';

export async function moveGenerator(tree: Tree, rawSchema: Schema) {
  const projectConfig = readProjectConfiguration(tree, rawSchema.projectName);
  checkDestination(tree, rawSchema, projectConfig);
  const schema = normalizeSchema(tree, rawSchema, projectConfig);

  moveProjectConfiguration(tree, schema, projectConfig);
  moveProject(tree, schema, projectConfig); // we MUST move the project first, if we don't we get a "This should never happen" error 🤦‍♀️
  updateImports(tree, schema, projectConfig);
  updateProjectRootFiles(tree, schema, projectConfig);
  updateCypressConfig(tree, schema, projectConfig);
  updateJestConfig(tree, schema, projectConfig);
  updateStorybookConfig(tree, schema, projectConfig);
  updateEslintrcJson(tree, schema, projectConfig);
  updateReadme(tree, schema);
  updatePackageJson(tree, schema);
  updateBuildTargets(tree, schema);
  updateDefaultProject(tree, schema);
  updateImplicitDependencies(tree, schema);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

export default moveGenerator;

export const moveSchematic = convertNxGenerator(moveGenerator);
