import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { nxVersion } from '../../utils/versions';
import type { GeneratorOptions } from './schema';
import { AppMigrator } from './utilities/app.migrator';
import { getAllProjects } from './utilities/get-all-projects';
import { normalizeOptions } from './utilities/normalize-options';
import { ProjectMigrator } from './utilities/project.migrator';
import {
  createWorkspaceFiles,
  createNxJson,
  createRootKarmaConfig,
  decorateAngularCli,
  updatePackageJson,
  updateRootTsConfig,
  updateTsLint,
  updateWorkspaceConfigDefaults,
  validateWorkspace,
} from './utilities/workspace';

export async function migrateFromAngularCli(
  tree: Tree,
  rawOptions: GeneratorOptions
) {
  const projects = getAllProjects(tree);
  const options = normalizeOptions(rawOptions, projects);

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
    validateWorkspace(tree, projects);

    const migrators: ProjectMigrator[] = [
      ...projects.apps.map((app) => new AppMigrator(tree, options, app)),
      // TODO: add libraries migrator when support for libs is added
    ];

    // TODO: validate all projects and collect errors before migrating when
    // multiple projects are supported

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
    // TODO: check later if it's still needed
    updateTsLint(tree);
    await createWorkspaceFiles(tree);

    // migrate all projects
    for (const migrator of migrators) {
      await migrator.migrate();
    }

    // needs to be done last because the Angular CLI workspace can have one
    // in the root for the root application, so we wait until that root Karma
    // config is moved when the projects are migrated before creating this one
    createRootKarmaConfig(tree);

    await formatFiles(tree);
  }

  if (!options.skipInstall) {
    return () => {
      installPackagesTask(tree);
    };
  }
}
