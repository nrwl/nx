import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
  readJson,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { nxVersion } from '../../utils/versions';
import type { GeneratorOptions } from './schema';
import { AppMigrator } from './utilities/app.migrator';
import { getAllProjects } from './utilities/get-all-projects';
import { LibMigrator } from './utilities/lib.migrator';
import { normalizeOptions } from './utilities/normalize-options';
import { ProjectMigrator } from './utilities/project.migrator';
import { validateProjects } from './utilities/validate-projects';
import {
  cleanupEsLintPackages,
  createNxJson,
  createRootKarmaConfig,
  createWorkspaceFiles,
  decorateAngularCli,
  getWorkspaceCapabilities,
  updatePackageJson,
  updateRootEsLintConfig,
  updateRootTsConfig,
  updateWorkspaceConfigDefaults,
  validateWorkspace,
} from './utilities/workspace';

export async function migrateFromAngularCli(
  tree: Tree,
  rawOptions: GeneratorOptions
) {
  validateWorkspace(tree);
  const projects = getAllProjects(tree);
  const options = normalizeOptions(tree, rawOptions, projects);

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
    // TODO(leo): remove when support for multiple apps is added
    if (projects.apps.length > 2) {
      throw new Error(
        'Can not convert workspaces with more than 1 application.'
      );
    }

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
      updateRootEsLintConfig(tree, eslintConfig);
      cleanupEsLintPackages(tree);
    }

    await formatFiles(tree);
  }

  if (!options.skipInstall) {
    return () => {
      installPackagesTask(tree);
    };
  }
}
