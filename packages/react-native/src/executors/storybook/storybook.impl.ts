import { join } from 'path';
import { ExecutorContext, logger } from '@nx/devkit';
import { fileExists } from '@nx/workspace/src/utilities/fileutils';
import * as chalk from 'chalk';
import { sync as globSync } from 'glob';

import { ReactNativeStorybookOptions } from './schema';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';
import { writeFileSync } from 'fs-extra';

export default async function* reactNativeStorybookExecutor(
  options: ReactNativeStorybookOptions,
  context: ExecutorContext
): AsyncGenerator<{ success: boolean }> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  logger.info(
    `${chalk.bold.cyan(
      'info'
    )} To see your Storybook stories on the device, you should start your mobile app for the <platform> of your choice (typically ios or android).`
  );

  // add storybook addons to app's package.json
  const packageJsonPath = join(context.root, projectRoot, 'package.json');
  if (fileExists(packageJsonPath))
    displayNewlyAddedDepsMessage(
      context.projectName,
      await syncDeps(
        context.projectName,
        projectRoot,
        context.root,
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
  const storiesFiles: string[] = options.searchDir.flatMap((dir) =>
    globSync(join(dir, options.pattern))
  );
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
