import {
  convertNxGenerator,
  formatFiles,
  readProjectConfiguration,
  removeProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { checkDestination } from './lib/check-destination';
import { createProjectConfigurationInNewDestination } from './lib/create-project-configuration-in-new-destination';
import { moveProjectFiles } from './lib/move-project-files';
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

  removeProjectConfiguration(tree, schema.projectName);
  moveProjectFiles(tree, schema, projectConfig);
  createProjectConfigurationInNewDestination(tree, schema, projectConfig);
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
