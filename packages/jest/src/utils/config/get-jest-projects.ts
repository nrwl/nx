import { createProjectGraphAsync, type TargetConfiguration } from '@nx/devkit';
import { join, parse } from 'path';
import yargs = require('yargs-parser');

function getJestConfigProjectPath(projectJestConfigPath: string): string {
  return join('<rootDir>', projectJestConfigPath);
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

  removeDuplicates(jestConfigurations);
  return Array.from(jestConfigurations);
}

// If two paths result in same project, prefer the more specific path.
// e.g. <rootDir>/demo/jest.config.js over <rootDir>/demo
function removeDuplicates(configs: Set<string>): void {
  configs.forEach((config) => {
    const { dir, ext } = parse(config);
    // If the directory has been added previously, remove it and keep the current, more specific path.
    if (ext) configs.delete(dir);
  });
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
