import type { Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
  readJson,
  readWorkspaceConfiguration,
  updateJson,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { nxVersion } from '../../utils/versions';
import type { ProjectMigrator } from './migrators';
import { AppMigrator, LibMigrator } from './migrators';
import type { GeneratorOptions } from './schema';
import {
  cleanupEsLintPackages,
  createNxJson,
  createRootKarmaConfig,
  createWorkspaceFiles,
  decorateAngularCli,
  getAllProjects,
  getWorkspaceCapabilities,
  normalizeOptions,
  updatePackageJson,
  updateRootEsLintConfig,
  updateRootTsConfig,
  updateWorkspaceConfigDefaults,
  validateProjects,
  validateWorkspace,
} from './utilities';

export async function migrateFromAngularCli(
  tree: Tree,
  rawOptions: GeneratorOptions
) {
  validateWorkspace(tree);
  const projects = getAllProjects(tree);
  const options = normalizeOptions(tree, rawOptions, projects);

  const defaultProject = projects.apps.find((app) => app.config.root === '');

  if (options.preserveAngularCliLayout) {
    addDependenciesToPackageJson(
      tree,
      {},
      {
        nx: nxVersion,
        '@nrwl/workspace': nxVersion,
      }
    );
    createNxJson(tree, options, true);
    decorateAngularCli(tree);
  } else {
    const migrators: ProjectMigrator[] = [
      ...projects.apps.map((app) => new AppMigrator(tree, options, app)),
      ...projects.libs.map((lib) => new LibMigrator(tree, options, lib)),
    ];

    // validate all projects
    validateProjects(migrators);

    const workspaceCapabilities = getWorkspaceCapabilities(tree, projects);

    /**
     * Keep a copy of the root eslint config to restore it later. We need to
     * do this because the root config can also be the config for the app at
     * the root of the Angular CLI workspace and it will be moved as part of
     * the app migration.
     */
    let eslintConfig =
      workspaceCapabilities.eslint && tree.exists('.eslintrc.json')
        ? readJson(tree, '.eslintrc.json')
        : undefined;

    // create and update root files and configurations
    updateJson(tree, 'angular.json', (json) => ({
      ...json,
      version: 2,
      $schema: undefined,
    }));
    createNxJson(tree, options);
    updateWorkspaceConfigDefaults(tree);
    updateRootTsConfig(tree);
    updatePackageJson(tree);
    decorateAngularCli(tree);
    await createWorkspaceFiles(tree);

    // migrate all projects
    for (const migrator of migrators) {
      await migrator.migrate();
    }

    /**
     * This needs to be done last because the Angular CLI workspace can have
     * these files in the root for the root application, so we wait until
     * those root config files are moved when the projects are migrated.
     */
    if (workspaceCapabilities.karma) {
      createRootKarmaConfig(tree);
    }
    if (workspaceCapabilities.eslint) {
      updateRootEsLintConfig(tree, eslintConfig, options.unitTestRunner);
      cleanupEsLintPackages(tree);
    }

    await formatFiles(tree);
  }

  if (defaultProject) {
    const workspaceConfig = readWorkspaceConfiguration(tree);
    updateWorkspaceConfiguration(tree, {
      ...workspaceConfig,
      defaultProject: defaultProject.name,
    });
  }

  if (!options.skipInstall) {
    return () => {
      installPackagesTask(tree);
    };
  }
}
