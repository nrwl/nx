import 'dotenv/config';

import { ExecutorContext, logger, ProjectConfiguration } from '@nrwl/devkit';
import { readFileIfExisting } from '@nrwl/workspace/src/core/file-utils';
import {
  getProjectNamesAndPorts,
  thereAreProjectsWithConflictingPorts,
} from './composition-functions';
import storybookExecutor from '../storybook/storybook.impl';

export default async function* storybookCompositionExecutor(
  options: {},
  context: ExecutorContext
) {
  const projectConfiguration: ProjectConfiguration =
    context.workspace.projects[context.projectName];

  if (
    !projectConfiguration?.targets?.storybook?.options?.port ||
    !projectConfiguration?.targets?.storybook?.options?.config?.configFolder
  ) {
    logger.error(`Project ${context.projectName} does not exist, or does not have a valid Storybook configuration.
        Please try again, and provide a valid project name.`);
    return;
  }

  const mainProjectPort = projectConfiguration.targets.storybook.options.port;
  const mainProjectStorybookFolderPath =
    projectConfiguration.targets.storybook.options.config.configFolder;

  const mainJsFile = readFileIfExisting(
    `${mainProjectStorybookFolderPath}/main.js`
  );

  const projectPortsByName = getProjectNamesAndPorts(
    mainJsFile,
    `${mainProjectStorybookFolderPath}/main.js`
  );
  const projectNames = Object.keys(projectPortsByName);
  const projectPorts = Object.values(projectPortsByName);

  if (!projectNames || !projectPorts) {
    logger.error(`Project ${context.projectName} does not have a valid Storybook configuration.
        Please try again, and provide a valid project name.`);
    return;
  }

  if (thereAreProjectsWithConflictingPorts(projectPorts, mainProjectPort)) {
    logger.error(
      `There are conflicting ports in the Storybook composition. Please, make sure there are no conflicting ports and try running the executor again.`
    );
    return;
  }

  logger.info(
    `You are now running Storybook Composition using ${context.projectName} as host. 
    
    You can see your Storybook composition on

    http://localhost:${mainProjectPort}`
  );

  // Storybook Executor for main project
  const mainProjectUiFramework =
    projectConfiguration.targets.storybook.options.uiFramework;
  const mainProjectConfig =
    projectConfiguration.targets.storybook.options.config;
  const mainProjectStorybookConfigurations =
    projectConfiguration.targets.storybook.configurations;

  storybookExecutor(
    {
      port: mainProjectPort,
      uiFramework: mainProjectUiFramework,
      config: mainProjectConfig,
    },
    {
      ...context,
      projectName: context.projectName,
      targetName: 'storybook',
      target: {
        executor: '@nrwl/storybook:storybook',
        options: {
          uiFramework: mainProjectUiFramework,
          port: mainProjectPort,
          config: mainProjectConfig,
        },
        configurations: mainProjectStorybookConfigurations,
      },
    }
  );

  // Storybook Executor for other projects
  projectNames.forEach((projectName) => {
    const composedProjectConfiguration: ProjectConfiguration =
      context.workspace.projects[projectName];
    const composedProjectPort = projectPortsByName[projectName];
    const composedProjectUiFramework =
      composedProjectConfiguration.targets.storybook.options.uiFramework;
    const composedProjectConfig =
      composedProjectConfiguration.targets.storybook.options.config;
    const composedProjectStorybookConfigurations =
      composedProjectConfiguration.targets.storybook.configurations;

    storybookExecutor(
      {
        port: composedProjectPort,
        uiFramework: composedProjectUiFramework,
        config: composedProjectConfig,
      },
      {
        ...context,
        projectName: projectName,
        targetName: 'storybook',
        target: {
          executor: '@nrwl/storybook:storybook',
          options: {
            uiFramework: composedProjectUiFramework,
            port: composedProjectPort,
            config: composedProjectConfig,
          },
          configurations: composedProjectStorybookConfigurations,
        },
      }
    );
  });

  // This Promise intentionally never resolves, leaving the process running
  await new Promise<{ success: boolean }>(() => {});
}
