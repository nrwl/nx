import {
  formatFiles,
  readProjectConfiguration,
  removeProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { checkDestination } from './lib/check-destination';
import { createProjectConfigurationInNewDestination } from './lib/create-project-configuration-in-new-destination';
import { moveProjectFiles } from './lib/move-project-files';
import { normalizeSchema } from './lib/normalize-schema';
import { runAngularPlugin } from './lib/run-angular-plugin';
import { updateBuildTargets } from './lib/update-build-targets';
import { updateCypressConfig } from './lib/update-cypress-config';
import { updateDefaultProject } from './lib/update-default-project';
import { updateEslintConfig } from './lib/update-eslint-config';
import { updateImplicitDependencies } from './lib/update-implicit-dependencies';
import { updateImports } from './lib/update-imports';
import { updateJestConfig } from './lib/update-jest-config';
import { updatePackageJson } from './lib/update-package-json';
import { updateProjectRootFiles } from './lib/update-project-root-files';
import { updateReadme } from './lib/update-readme';
import { updateStorybookConfig } from './lib/update-storybook-config';
import {
  maybeMigrateEslintConfigIfRootProject,
  maybeExtractJestConfigBase,
  maybeExtractTsConfigBase,
} from './lib/extract-base-configs';
import { Schema } from './schema';

export async function moveGenerator(tree: Tree, rawSchema: Schema) {
  await moveGeneratorInternal(tree, {
    projectNameAndRootFormat: 'derived',
    ...rawSchema,
  });
}

export async function moveGeneratorInternal(tree: Tree, rawSchema: Schema) {
  let projectConfig = readProjectConfiguration(tree, rawSchema.projectName);
  const schema = await normalizeSchema(tree, rawSchema, projectConfig);
  checkDestination(tree, schema, rawSchema.destination);

  if (projectConfig.root === '.') {
    maybeExtractTsConfigBase(tree);
    await maybeExtractJestConfigBase(tree);
    // Reload config since it has been updated after extracting base configs
    projectConfig = readProjectConfiguration(tree, rawSchema.projectName);
  }

  removeProjectConfiguration(tree, schema.projectName);
  moveProjectFiles(tree, schema, projectConfig);
  createProjectConfigurationInNewDestination(tree, schema, projectConfig);
  updateImports(tree, schema, projectConfig);
  updateProjectRootFiles(tree, schema, projectConfig);
  updateCypressConfig(tree, schema, projectConfig);
  updateJestConfig(tree, schema, projectConfig);
  updateStorybookConfig(tree, schema, projectConfig);
  updateEslintConfig(tree, schema, projectConfig);
  updateReadme(tree, schema);
  updatePackageJson(tree, schema);
  updateBuildTargets(tree, schema);
  updateDefaultProject(tree, schema);
  updateImplicitDependencies(tree, schema);

  if (projectConfig.root === '.') {
    // we want to migrate eslint config once the root project files are moved
    maybeMigrateEslintConfigIfRootProject(tree, projectConfig);
  }

  await runAngularPlugin(tree, schema);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}

export default moveGenerator;
