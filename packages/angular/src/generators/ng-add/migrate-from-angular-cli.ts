import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  installPackagesTask,
  readJson,
  updateJson,
} from '@nrwl/devkit';
import { convertToNxProjectGenerator } from '@nrwl/workspace/generators';
import { prettierVersion } from '@nrwl/workspace/src/utils/versions';
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
  deleteAngularJson,
  deleteGitKeepFilesIfNotNeeded,
  formatFilesTask,
  getAllProjects,
  getWorkspaceRootFileTypesInfo,
  normalizeOptions,
  updatePackageJson,
  updatePrettierConfig,
  updateRootEsLintConfig,
  updateRootTsConfig,
  updateVsCodeRecommendedExtensions,
  updateWorkspaceConfigDefaults,
  validateWorkspace,
} from './utilities';

export async function migrateFromAngularCli(
  tree: Tree,
  rawOptions: GeneratorOptions
): Promise<GeneratorCallback> {
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
        prettier: prettierVersion,
      }
    );
    createNxJson(tree, options);
    decorateAngularCli(tree);
    updateVsCodeRecommendedExtensions(tree);
    await updatePrettierConfig(tree);

    // convert workspace config format to standalone project configs
    updateJson(tree, 'angular.json', (json) => ({
      ...json,
      version: 2,
      $schema: undefined,
    }));
    await convertToNxProjectGenerator(tree, { all: true, skipFormat: true });
  } else {
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
    if (workspaceRootFileTypesInfo.karma) {
      createRootKarmaConfig(tree);
    }
    if (workspaceRootFileTypesInfo.eslint) {
      updateRootEsLintConfig(tree, eslintConfig, options.unitTestRunner);
      cleanupEsLintPackages(tree);
    }

    deleteGitKeepFilesIfNotNeeded(tree);
  }

  deleteAngularJson(tree);

  if (!options.skipInstall) {
    return () => {
      installPackagesTask(tree);
      formatFilesTask(tree);
    };
  }
}
