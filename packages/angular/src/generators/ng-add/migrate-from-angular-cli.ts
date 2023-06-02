import type { GeneratorCallback, Tree } from '@nx/devkit';
import { installPackagesTask, readJson, updateJson } from '@nx/devkit';
import type { ProjectMigrator } from './migrators';
import { AppMigrator, LibMigrator } from './migrators';
import type { GeneratorOptions } from './schema';
import {
  cleanupEsLintPackages,
  createNxJson,
  createRootKarmaConfig,
  createWorkspaceFiles,
  deleteAngularJson,
  deleteGitKeepFilesIfNotNeeded,
  ensureAngularDevKitPeerDependenciesAreInstalled,
  formatFilesTask,
  getAllProjects,
  getWorkspaceRootFileTypesInfo,
  updatePackageJson,
  updateRootEsLintConfig,
  updateRootTsConfig,
  updateWorkspaceConfigDefaults,
  validateWorkspace,
} from './utilities';

export async function migrateFromAngularCli(
  tree: Tree,
  options: GeneratorOptions
): Promise<GeneratorCallback> {
  validateWorkspace(tree);
  const projects = getAllProjects(tree);

  const angularJson = readJson(tree, 'angular.json') as any;
  ensureAngularDevKitPeerDependenciesAreInstalled(tree);

  const migrators: ProjectMigrator[] = [
    ...projects.apps.map((app) => new AppMigrator(tree, options, app)),
    ...projects.libs.map((lib) => new LibMigrator(tree, options, lib)),
  ];

  const workspaceRootFileTypesInfo = getWorkspaceRootFileTypesInfo(
    tree,
    migrators
  );

  /**
   * Keep a copy of the root eslint config to restore it later. We need to
   * do this because the root config can also be the config for the app at
   * the root of the Angular CLI workspace and it will be moved as part of
   * the app migration.
   */
  let eslintConfig =
    workspaceRootFileTypesInfo.eslint && tree.exists('.eslintrc.json')
      ? readJson(tree, '.eslintrc.json')
      : undefined;

  // create and update root files and configurations
  updateJson(tree, 'angular.json', (json) => ({
    ...json,
    version: 2,
    $schema: undefined,
  }));
  createNxJson(tree, options, angularJson.defaultProject);
  updateWorkspaceConfigDefaults(tree);
  updateRootTsConfig(tree);
  updatePackageJson(tree);
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
  if (workspaceRootFileTypesInfo.karma) {
    createRootKarmaConfig(tree);
  }
  if (workspaceRootFileTypesInfo.eslint) {
    updateRootEsLintConfig(tree, eslintConfig, options.unitTestRunner);
    cleanupEsLintPackages(tree);
  }

  deleteGitKeepFilesIfNotNeeded(tree);
  deleteAngularJson(tree);

  if (!options.skipInstall) {
    return () => {
      installPackagesTask(tree);
      formatFilesTask(tree);
    };
  }
}
