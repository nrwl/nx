import {
  formatFiles,
  installPackagesTask,
  readProjectConfiguration,
  removeProjectConfiguration,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { isProjectIncludedInPackageManagerWorkspaces } from '../../utilities/package-manager-workspaces.js';
import { addProjectToTsSolutionWorkspace } from '../../utilities/typescript/ts-solution-setup.js';
import { checkDestination } from './lib/check-destination.js';
import { createProjectConfigurationInNewDestination } from './lib/create-project-configuration-in-new-destination.js';
import {
  maybeExtractJestConfigBase,
  maybeExtractTsConfigBase,
  maybeMigrateEslintConfigIfRootProject,
} from './lib/extract-base-configs.js';
import { moveProjectFiles } from './lib/move-project-files.js';
import { normalizeSchema } from './lib/normalize-schema.js';
import { runAngularPlugin } from './lib/run-angular-plugin.js';
import { updateBuildTargets } from './lib/update-build-targets.js';
import { updateCypressConfig } from './lib/update-cypress-config.js';
import { updateDefaultProject } from './lib/update-default-project.js';
import { updateEslintConfig } from './lib/update-eslint-config.js';
import { updateImplicitDependencies } from './lib/update-implicit-dependencies.js';
import { updateImports } from './lib/update-imports.js';
import { updateJestConfig } from './lib/update-jest-config.js';
import { updatePackageJson } from './lib/update-package-json.js';
import { updateProjectRootFiles } from './lib/update-project-root-files.js';
import { updateReadme } from './lib/update-readme.js';
import { updateStorybookConfig } from './lib/update-storybook-config.js';
import { Schema } from './schema.js';

export async function moveGenerator(tree: Tree, rawSchema: Schema) {
  let projectConfig = readProjectConfiguration(tree, rawSchema.projectName);
  const wasIncludedInWorkspaces = isProjectIncludedInPackageManagerWorkspaces(
    tree,
    projectConfig.root
  );
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

  let task: GeneratorCallback;
  if (wasIncludedInWorkspaces) {
    // check if the new destination is included in the package manager workspaces
    const isIncludedInWorkspaces = isProjectIncludedInPackageManagerWorkspaces(
      tree,
      schema.destination
    );
    if (!isIncludedInWorkspaces) {
      // the new destination is not included in the package manager workspaces
      // so we need to add it and run a package install to ensure the symlink
      // is created
      await addProjectToTsSolutionWorkspace(tree, schema.destination);
      task = () => installPackagesTask(tree, true);
    }
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  if (task) {
    return task;
  }
}

export default moveGenerator;
