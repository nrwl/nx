import {
  chain,
  move,
  noop,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import {
  addInstallTask,
  checkAndCleanWithSemver,
  formatFiles,
  offsetFromRoot,
} from '@nrwl/workspace';
import {
  applyWithSkipExisting,
  getProjectConfig,
  updateJsonInTree,
  readWorkspace,
} from '@nrwl/workspace/src/utils/ast-utils';
import {
  directoryExists,
  fileExists,
} from '@nrwl/workspace/src/utils/fileutils';
import { projectDir } from '@nrwl/workspace/src/utils/project-type';
import { lte } from 'semver';
import { StorybookMigrateDefault5to6Schema } from './schema';
import { storybookVersion } from '../../utils/versions';

let needsInstall = false;

export default function (schema: StorybookMigrateDefault5to6Schema): Rule {
  /**
   * The "all" flag - or the absense of "name"
   * should indicate that all Storybook instances everywhere in the
   * project should be migrated.
   *
   * Not running a migration for "all" does NOT make
   * sense, since everything links back to the root .storybook
   * directory, which will get migrated.
   * However, someone may want to do it step by step. But all should be migrated
   * eventually.
   */
  return (tree: Tree, context: SchematicContext) => {
    let configFolder: string;
    let uiFramework: string;
    const runAll = schema.all && !schema.name;

    if (!runAll && schema.name) {
      const projectConfig = getProjectConfig(tree, schema.name);
      if (projectConfig.targets && projectConfig.targets.storybook) {
        configFolder =
          projectConfig.targets.storybook.options.config.configFolder;
        uiFramework = projectConfig.targets.storybook.options.uiFramework;
      }
      if (projectConfig.architect && projectConfig.architect.storybook) {
        configFolder =
          projectConfig.architect.storybook.options.config.configFolder;
        uiFramework = projectConfig.architect.storybook.options.uiFramework;
      }
    }
    return chain([
      !runAll && configFolder
        ? migrateStorybookInstance(
            schema.keepOld,
            schema.name,
            uiFramework,
            configFolder
          )
        : migrateAllStorybookInstances(schema.keepOld),
      runAll ? migrateRootLevelStorybookInstance(schema.keepOld) : noop(),
      runAll ? upgradeStorybookPackagesInPackageJson() : noop(),
    ]);
  };
}

export function migrateAllStorybookInstances(keepOld: boolean): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.debug('adding .storybook folder to lib');
    const workspaceJson = readWorkspace(tree);
    const projects: string[] = Object.keys(workspaceJson.projects);
    const projectsThatHaveStorybookConfiguration: {
      name: string;
      uiFramework: string;
      configFolder: string;
    }[] = projects.map((project: string) => {
      if (
        workspaceJson.projects[project].targets &&
        workspaceJson.projects[project].targets.storybook
      ) {
        return {
          name: project,
          uiFramework:
            workspaceJson.projects[project].targets.storybook.options
              .uiFramework,
          configFolder:
            workspaceJson.projects[project].targets.storybook.options.config
              .configFolder,
        };
      }
      if (
        workspaceJson.projects[project].architect &&
        workspaceJson.projects[project].architect.storybook
      ) {
        return {
          name: project,
          uiFramework:
            workspaceJson.projects[project].architect.storybook.options
              .uiFramework,
          configFolder:
            workspaceJson.projects[project].architect.storybook.options.config
              .configFolder,
        };
      }
    });

    return chain(
      projectsThatHaveStorybookConfiguration
        .filter(
          (projectWithStorybook) =>
            projectWithStorybook && projectWithStorybook.configFolder
        )
        .map((projectWithStorybook) => {
          return chain([
            migrateStorybookInstance(
              keepOld,
              projectWithStorybook.name,
              projectWithStorybook.uiFramework,
              projectWithStorybook.configFolder
            ),
          ]);
        })
    );
  };
}

export function migrateStorybookInstance(
  keepOld: boolean,
  projectName: string,
  uiFramework: string,
  configFolder?: string
): Rule {
  return chain([
    migrateProjectLevelStorybookInstance(
      keepOld,
      projectName,
      uiFramework,
      configFolder
    ),
  ]);
}

function maybeUpdateVersion(): Rule {
  return updateJsonInTree('package.json', (json) => {
    json.dependencies = json.dependencies || {};
    json.devDependencies = json.devDependencies || {};

    const allStorybookPackagesInDependencies = Object.keys(
      json.dependencies
    ).filter((packageName: string) => packageName.startsWith('@storybook/'));

    const allStorybookPackagesInDevDependencies = Object.keys(
      json.devDependencies
    ).filter((packageName: string) => packageName.startsWith('@storybook/'));

    const storybookPackages = [
      ...allStorybookPackagesInDependencies,
      ...allStorybookPackagesInDevDependencies,
    ];

    storybookPackages.forEach((storybookPackageName) => {
      if (json.dependencies[storybookPackageName]) {
        const version = checkAndCleanWithSemver(
          storybookPackageName,
          json.dependencies[storybookPackageName]
        );
        if (lte(version, '6.0.0')) {
          json.dependencies[storybookPackageName] = storybookVersion;
          needsInstall = true;
        }
      }
      if (json.devDependencies[storybookPackageName]) {
        const version = checkAndCleanWithSemver(
          storybookPackageName,
          json.devDependencies[storybookPackageName]
        );
        if (lte(version, '6.0.0')) {
          json.devDependencies[storybookPackageName] = storybookVersion;
          needsInstall = true;
        }
      }
    });
    return json;
  });
}

function upgradeStorybookPackagesInPackageJson(): Rule {
  /**
   * Should upgrade all @storybook/* packages in package.json
   */
  return (tree: Tree, context: SchematicContext) => {
    return chain([
      maybeUpdateVersion(),
      formatFiles(),
      addInstallTask({ skipInstall: !needsInstall }),
    ]);
  };
}

function deleteOldFiles(configFolderDir: string): Rule {
  return (tree: Tree) => {
    const dir = tree.getDir(configFolderDir);
    dir.visit((file) => {
      if (file.includes('addons.js') || file.includes('config.js')) {
        tree.delete(file);
      }
    });
    return tree;
  };
}

function moveOldFiles(configFolderDir: string): Rule {
  return move(
    configFolderDir,
    configFolderDir.replace('.storybook', '.old_storybook')
  );
}

function migrateProjectLevelStorybookInstance(
  keepOld: boolean,
  projectName: string,
  uiFramework: string,
  configFolder: string
): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(tree, projectName);
    const { projectType } = getProjectConfig(tree, projectName);
    const projectDirectory = projectDir(projectType);
    const old_folder_exists_already = directoryExists(
      configFolder.replace('.storybook', '.old_storybook')
    );
    const new_config_exists_already = fileExists(`${configFolder}/main.js`);
    return chain([
      old_folder_exists_already || new_config_exists_already
        ? noop()
        : keepOld
        ? moveOldFiles(configFolder)
        : deleteOldFiles(configFolder),
      new_config_exists_already
        ? noop()
        : applyWithSkipExisting(
            url('../configuration/project-files/.storybook'),
            [
              template({
                tmpl: '',
                uiFramework,
                offsetFromRoot: offsetFromRoot(projectConfig.root),
                projectType: projectDirectory,
              }),
              move(configFolder),
            ]
          ),
    ])(tree, context);
  };
}

function migrateRootLevelStorybookInstance(keepOld: boolean): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const old_folder_exists_already = directoryExists('.old_storybook');
    const new_config_exists_already = fileExists(`.storybook/main.js`);
    return chain([
      old_folder_exists_already || new_config_exists_already
        ? noop()
        : keepOld
        ? moveOldFiles('.storybook')
        : deleteOldFiles(`.storybook`),
      old_folder_exists_already || new_config_exists_already
        ? noop()
        : applyWithSkipExisting(url('../configuration/root-files/.storybook'), [
            move('.storybook'),
          ]),
    ])(tree, context);
  };
}
