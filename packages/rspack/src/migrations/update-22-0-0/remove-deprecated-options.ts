import {
  type Tree,
  formatFiles,
  updateJson,
  visitNotIgnoredFiles,
  readProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export default async function removeDeprecatedOptions(tree: Tree) {
  const projects = new Set<string>();

  // Find all projects using @nx/rspack:rspack or @nx/rspack:dev-server executors
  forEachExecutorOptions(tree, '@nx/rspack:rspack', (options, project) => {
    projects.add(project);
  });

  forEachExecutorOptions(tree, '@nx/rspack:dev-server', (options, project) => {
    projects.add(project);
  });

  // Update project configurations to remove deprecated options
  for (const projectName of projects) {
    const projectConfig = readProjectConfiguration(tree, projectName);
    let hasChanges = false;

    // Check all targets for deprecated options
    if (projectConfig.targets) {
      for (const targetName in projectConfig.targets) {
        const target = projectConfig.targets[targetName];

        if (
          target.executor === '@nx/rspack:rspack' ||
          target.executor === '@nx/rspack:dev-server'
        ) {
          // Handle options
          if (target.options) {
            if ('deleteOutputPath' in target.options) {
              delete target.options.deleteOutputPath;
              hasChanges = true;
            }
            if ('sassImplementation' in target.options) {
              delete target.options.sassImplementation;
              hasChanges = true;
            }
          }

          // Handle configurations
          if (target.configurations) {
            for (const configName in target.configurations) {
              const config = target.configurations[configName];
              if ('deleteOutputPath' in config) {
                delete config.deleteOutputPath;
                hasChanges = true;
              }
              if ('sassImplementation' in config) {
                delete config.sassImplementation;
                hasChanges = true;
              }
            }
          }
        }
      }
    }

    if (hasChanges) {
      updateJson(
        tree,
        `${projectConfig.root}/project.json`,
        () => projectConfig
      );
    }
  }

  // Find and update any rspack.config.ts/js files that might use these options
  const rspackConfigFiles = new Set<string>();

  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (
      filePath.endsWith('rspack.config.ts') ||
      filePath.endsWith('rspack.config.js')
    ) {
      rspackConfigFiles.add(filePath);
    }
  });

  for (const configFile of rspackConfigFiles) {
    let contents = tree.read(configFile, 'utf-8');
    let hasChanges = false;

    // Check if the file contains deleteOutputPath
    if (contents.includes('deleteOutputPath')) {
      // Add a comment explaining the migration
      const deleteOutputPathRegex = /deleteOutputPath\s*:\s*(?:true|false)/g;
      const matches = contents.match(deleteOutputPathRegex);

      if (matches) {
        // Replace deleteOutputPath with a comment
        contents = contents.replace(
          deleteOutputPathRegex,
          '// deleteOutputPath option has been removed in Nx v22. Use output.clean in your Rspack config instead'
        );
        hasChanges = true;
      }
    }

    // Check if the file contains sassImplementation
    if (contents.includes('sassImplementation')) {
      // Add a comment explaining the removal
      const sassImplementationRegex =
        /sassImplementation\s*:\s*['"`](?:sass|sass-embedded)['"`]/g;
      const matches = contents.match(sassImplementationRegex);

      if (matches) {
        // Replace sassImplementation with a comment
        contents = contents.replace(
          sassImplementationRegex,
          '// sassImplementation option has been removed in Nx v22. sass-embedded is now always used'
        );
        hasChanges = true;
      }
    }

    if (hasChanges) {
      tree.write(configFile, contents);
    }
  }

  await formatFiles(tree);
}
