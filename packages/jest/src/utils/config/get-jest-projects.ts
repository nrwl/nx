import {
  createProjectGraphAsync,
  type ProjectsConfigurations,
  type TargetConfiguration,
} from '@nx/devkit';
import { readWorkspaceConfig } from 'nx/src/project-graph/file-utils';
import { join } from 'path';
import * as yargs from 'yargs-parser';

function getJestConfigProjectPath(projectJestConfigPath: string): string {
  return join('<rootDir>', projectJestConfigPath);
}

/**
 * TODO(v21): Remove this function
 * @deprecated To get projects use {@link getJestProjectsAsync} instead. This will be removed in v21.
 * Get a list of paths to all the jest config files
 * using the Nx Jest executor.
 *
 * This is used to configure Jest multi-project support. To support projects
 * using inferred targets @see getJestProjectsAsync
 *
 * To add a project not using the Nx Jest executor:
 * export default {
 *   projects: [...getJestProjects(), '<rootDir>/path/to/jest.config.ts'];
 * }
 *
 **/
export function getJestProjects() {
  const ws = readWorkspaceConfig({
    format: 'nx',
  }) as ProjectsConfigurations;
  const jestConfigurationSet = new Set<string>();
  for (const projectConfig of Object.values(ws.projects)) {
    if (!projectConfig.targets) {
      continue;
    }
    for (const targetConfiguration of Object.values(projectConfig.targets)) {
      if (
        targetConfiguration.executor !== '@nx/jest:jest' &&
        targetConfiguration.executor !== '@nrwl/jest:jest'
      ) {
        continue;
      }
      if (targetConfiguration.options?.jestConfig) {
        jestConfigurationSet.add(
          getJestConfigProjectPath(targetConfiguration.options.jestConfig)
        );
      }
      if (targetConfiguration.configurations) {
        for (const configurationObject of Object.values(
          targetConfiguration.configurations
        )) {
          if (configurationObject.jestConfig) {
            jestConfigurationSet.add(
              getJestConfigProjectPath(configurationObject.jestConfig)
            );
          }
        }
      }
    }
  }
  return Array.from(jestConfigurationSet);
}

/**
 * a list of nested projects that have jest configured
 * to be used in the testPathIgnorePatterns property of a given jest config
 * https://jestjs.io/docs/configuration#testpathignorepatterns-arraystring
 * */
export function getNestedJestProjects() {
  // TODO(caleb): get current project path and list of all projects and their rootDir
  // return a list of all projects that are nested in the current projects path
  // always include node_modules as that's the default

  const allProjects = getJestProjects();
  return ['/node_modules/'];
}

/**
 * Get a list of paths to all the jest config files
 * using the Nx Jest executor and `@nx/run:commands`
 * running `jest`.
 *
 * This is used to configure Jest multi-project support.
 *
 * To add a project not using the Nx Jest executor:
 * export default async () => ({
 *   projects: [...(await getJestProjectsAsync()), '<rootDir>/path/to/jest.config.ts'];
 * });
 *
 **/
export async function getJestProjectsAsync() {
  const graph = await createProjectGraphAsync({
    exitOnError: false,
    resetDaemonClient: true,
  });
  const jestConfigurations = new Set<string>();
  for (const node of Object.values(graph.nodes)) {
    const projectConfig = node.data;
    if (!projectConfig.targets) {
      continue;
    }
    for (const targetConfiguration of Object.values(projectConfig.targets)) {
      if (
        targetConfiguration.executor === '@nx/jest:jest' ||
        targetConfiguration.executor === '@nrwl/jest:jest'
      ) {
        collectJestConfigFromJestExecutor(
          targetConfiguration,
          jestConfigurations
        );
      } else if (targetConfiguration.executor === 'nx:run-commands') {
        collectJestConfigFromRunCommandsExecutor(
          targetConfiguration,
          projectConfig.root,
          jestConfigurations
        );
      }
    }
  }

  return Array.from(jestConfigurations);
}

function collectJestConfigFromJestExecutor(
  targetConfiguration: TargetConfiguration,
  jestConfigurations: Set<string>
): void {
  if (targetConfiguration.options?.jestConfig) {
    jestConfigurations.add(
      getJestConfigProjectPath(targetConfiguration.options.jestConfig)
    );
  }
  if (targetConfiguration.configurations) {
    for (const configurationObject of Object.values(
      targetConfiguration.configurations
    )) {
      if (configurationObject.jestConfig) {
        jestConfigurations.add(
          getJestConfigProjectPath(configurationObject.jestConfig)
        );
      }
    }
  }
}

function collectJestConfigFromRunCommandsExecutor(
  targetConfiguration: TargetConfiguration,
  projectRoot: string,
  jestConfigurations: Set<string>
): void {
  if (targetConfiguration.options?.command) {
    collectJestConfigFromCommand(
      targetConfiguration.options.command,
      targetConfiguration.options.cwd ?? projectRoot,
      jestConfigurations
    );
  } else if (targetConfiguration.options?.commands) {
    for (const command of targetConfiguration.options.commands) {
      const commandScript =
        typeof command === 'string' ? command : command.command;
      collectJestConfigFromCommand(
        commandScript,
        targetConfiguration.options.cwd ?? projectRoot,
        jestConfigurations
      );
    }
  }

  if (targetConfiguration.configurations) {
    for (const configurationObject of Object.values(
      targetConfiguration.configurations
    )) {
      if (configurationObject.command) {
        collectJestConfigFromCommand(
          configurationObject.command,
          configurationObject.cwd ?? projectRoot,
          jestConfigurations
        );
      } else if (configurationObject.commands) {
        for (const command of configurationObject.commands) {
          const commandScript =
            typeof command === 'string' ? command : command.command;
          collectJestConfigFromCommand(
            commandScript,
            configurationObject.cwd ?? projectRoot,
            jestConfigurations
          );
        }
      }
    }
  }
}

function collectJestConfigFromCommand(
  command: string,
  cwd: string,
  jestConfigurations: Set<string>
) {
  const jestCommandRegex =
    /(?<=^|&)(?:[^&\r\n\s]* )*jest(?: [^&\r\n\s]*)*(?=$|&)/g;
  const matches = command.match(jestCommandRegex);
  if (!matches) {
    return;
  }

  for (const match of matches) {
    const parsed = yargs(match, {
      configuration: { 'strip-dashed': true },
      string: ['config'],
    });
    if (parsed.config) {
      jestConfigurations.add(
        getJestConfigProjectPath(join(cwd, parsed.config))
      );
    } else {
      jestConfigurations.add(getJestConfigProjectPath(cwd));
    }
  }
}
