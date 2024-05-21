import { join, relative, resolve, dirname } from 'path';
import { ExecutorContext, logger, readJsonFile } from '@nx/devkit';
import { fileExists } from '@nx/workspace/src/utilities/fileutils';
import * as chalk from 'chalk';
import { sync as globSync } from 'glob';

import { ReactNativeStorybookOptions } from './schema';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';
import { writeFileSync } from 'fs-extra';
import { PackageJson } from 'nx/src/utils/package-json';

/**
 * TODO (@xiongemi): remove this function in v20.
 * @deprecated Going to use the default react storybook target. Use @nx/react:storybook executor instead.
 */
export default async function* reactNativeStorybookExecutor(
  options: ReactNativeStorybookOptions,
  context: ExecutorContext
): AsyncGenerator<{ success: boolean }> {
  const { syncDeps: isSyncDepsEnabled = true } = options;

  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  logger.info(
    `${chalk.bold.cyan(
      'info'
    )} To see your Storybook stories on the device, you should start your mobile app for the <platform> of your choice (typically ios or android).`
  );

  // add storybook addons to app's package.json
  const packageJsonPath = join(context.root, projectRoot, 'package.json');
  const workspacePackageJsonPath = join(context.root, 'package.json');

  const workspacePackageJson = readJsonFile<PackageJson>(
    workspacePackageJsonPath
  );
  const projectPackageJson = readJsonFile<PackageJson>(packageJsonPath);

  if (isSyncDepsEnabled && fileExists(packageJsonPath))
    displayNewlyAddedDepsMessage(
      context.projectName,
      await syncDeps(
        context.projectName,
        projectPackageJson,
        packageJsonPath,
        workspacePackageJson,
        context.projectGraph,
        [
          `@storybook/react-native`,
          '@storybook/addon-ondevice-actions',
          '@storybook/addon-ondevice-backgrounds',
          '@storybook/addon-ondevice-controls',
          '@storybook/addon-ondevice-notes',
          '@react-native-async-storage/async-storage',
          'react-native-safe-area-context',
        ]
      )
    );

  runCliStorybook(context.root, options);
  yield { success: true };
}

export function runCliStorybook(
  workspaceRoot: string,
  options: ReactNativeStorybookOptions
) {
  const storiesFiles: string[] = options.searchDir.flatMap((dir) => {
    const storyFilePaths: string[] = globSync(join(dir, options.pattern));

    return storyFilePaths.map((storyFilePath) => {
      const loaderPath: string = resolve(dirname(options.outputFile));
      return relative(loaderPath, storyFilePath);
    });
  });

  if (storiesFiles.length === 0) {
    logger.warn(`${chalk.bold.yellow('warn')} No stories found.`);
  }

  const newContents = `// Auto-generated file created by nx
// DO NOT EDIT.
export function loadStories() {
  return [
    ${storiesFiles.map((story) => `require('${story}')`).join(',\n')}
  ];
}`;

  writeFileSync(join(workspaceRoot, options.outputFile), newContents);
}
