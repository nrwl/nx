import {
  convertNxGenerator,
  generateFiles,
  GeneratorCallback,
  getProjects,
  installPackagesTask,
  logger,
  readProjectConfiguration,
  Tree,
  updateJson,
  visitNotIgnoredFiles,
  offsetFromRoot,
} from '@nrwl/devkit';
import { lte } from 'semver';
import { StorybookMigrateDefault5to6Schema } from './schema';
import { storybookVersion } from '../../utils/versions';
import { join } from 'path';
import { checkAndCleanWithSemver } from '@nrwl/workspace/src/utilities/version-utils';

export function migrateDefaultsGenerator(
  tree: Tree,
  schema: StorybookMigrateDefault5to6Schema
) {
  if (schema.all === undefined) {
    schema.all = true;
  }
  if (schema.keepOld === undefined) {
    schema.keepOld = true;
  }

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
  let configFolder: string;
  let uiFramework: string;
  const runAll = schema.all && !schema.name;

  if (!runAll && schema.name) {
    const projectConfig = readProjectConfiguration(tree, schema.name);
    if (projectConfig.targets && projectConfig.targets.storybook) {
      configFolder =
        projectConfig.targets.storybook.options.config.configFolder;
      uiFramework = projectConfig.targets.storybook.options.uiFramework;
    }
    if (projectConfig.targets && projectConfig.targets.storybook) {
      configFolder =
        projectConfig.targets.storybook.options.config.configFolder;
      uiFramework = projectConfig.targets.storybook.options.uiFramework;
    }
  }
  if (!runAll && configFolder) {
    migrateStorybookInstance(
      tree,
      schema.keepOld,
      schema.name,
      uiFramework,
      configFolder
    );
  } else {
    migrateAllStorybookInstances(tree, schema.keepOld);
  }
  if (runAll) {
    migrateRootLevelStorybookInstance(tree, schema.keepOld);
    return upgradeStorybookPackagesInPackageJson(tree);
  }
}

export function migrateAllStorybookInstances(tree: Tree, keepOld: boolean) {
  logger.debug('adding .storybook folder to project');
  const projects = getProjects(tree);
  const projectsThatHaveStorybookConfiguration: {
    name: string;
    uiFramework: string;
    configFolder: string;
  }[] = [...projects.entries()]
    .filter(
      ([_, projectConfig]) =>
        projectConfig.targets && projectConfig.targets.storybook
    )
    .map(([projectName, projectConfig]) => {
      if (projectConfig.targets && projectConfig.targets.storybook) {
        return {
          name: projectName,
          uiFramework: projectConfig.targets.storybook.options.uiFramework,
          configFolder:
            projectConfig.targets.storybook.options.config.configFolder,
        };
      }
    });

  for (const projectWithStorybook of projectsThatHaveStorybookConfiguration) {
    migrateStorybookInstance(
      tree,
      keepOld,
      projectWithStorybook.name,
      projectWithStorybook.uiFramework,
      projectWithStorybook.configFolder
    );
  }
}

export function migrateStorybookInstance(
  tree: Tree,
  keepOld: boolean,
  projectName: string,
  uiFramework: string,
  configFolder?: string
) {
  migrateProjectLevelStorybookInstance(
    tree,
    keepOld,
    projectName,
    uiFramework,
    configFolder
  );
}

function maybeUpdateVersion(tree: Tree): GeneratorCallback {
  let needsInstall = false;
  updateJson(tree, 'package.json', (json) => {
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

  if (needsInstall) {
    return () => installPackagesTask(tree);
  }
}

function upgradeStorybookPackagesInPackageJson(tree: Tree) {
  /**
   * Should upgrade all @storybook/* packages in package.json
   */

  return maybeUpdateVersion(tree);
}

function deleteOldFiles(tree: Tree, configFolderDir: string) {
  visitNotIgnoredFiles(tree, configFolderDir, (file) => {
    if (file.includes('addons.js') || file.includes('config.js')) {
      tree.delete(file);
    }
  });
  // tree.delete(configFolderDir);
}

function moveOldFiles(tree: Tree, configFolderDir: string) {
  moveDirectory(
    tree,
    configFolderDir,
    configFolderDir.replace('.storybook', '.old_storybook')
  );
  // tree.delete(configFolderDir);
}

function migrateProjectLevelStorybookInstance(
  tree: Tree,
  keepOld: boolean,
  projectName: string,
  uiFramework: string,
  configFolder: string
) {
  const { root, projectType } = readProjectConfiguration(tree, projectName);
  const projectDirectory = projectType === 'application' ? 'app' : 'lib';
  const old_folder_exists_already = tree.exists(
    configFolder.replace('.storybook', '.old_storybook')
  );
  const new_config_exists_already = tree.exists(`${configFolder}/main.js`);
  if (old_folder_exists_already || new_config_exists_already) {
    return;
  }

  if (keepOld) {
    moveOldFiles(tree, configFolder);
  } else {
    deleteOldFiles(tree, configFolder);
  }
  if (tree.exists(configFolder)) {
    return;
  }
  generateFiles(
    tree,
    join(__dirname, '../configuration/project-files/.storybook'),
    configFolder,
    {
      tmpl: '',
      uiFramework,
      offsetFromRoot: offsetFromRoot(root),
      projectType: projectDirectory,
      useWebpack5: uiFramework === '@storybook/angular',
      existsRootWebpackConfig: tree.exists('.storybook/webpack.config.js'),
    }
  );
}

function migrateRootLevelStorybookInstance(tree: Tree, keepOld: boolean) {
  const old_folder_exists_already = tree.exists('.old_storybook');
  const new_config_exists_already = tree.exists(`.storybook/main.js`);
  if (old_folder_exists_already || new_config_exists_already) {
    return;
  }

  if (keepOld) {
    moveOldFiles(tree, '.storybook');
  } else {
    deleteOldFiles(tree, '.storybook');
  }

  generateFiles(
    tree,
    join(__dirname, '../configuration/root-files/.storybook'),
    '.storybook',
    {}
  );
}

export function moveDirectory(tree: Tree, from: string, to: string) {
  visitNotIgnoredFiles(tree, from, (file) => {
    tree.rename(file, file.replace(from, to));
  });
}

export default migrateDefaultsGenerator;
export const migrateDefaultsSchematic = convertNxGenerator(
  migrateDefaultsGenerator
);
