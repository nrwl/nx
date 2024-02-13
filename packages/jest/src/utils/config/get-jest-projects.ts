import { readNxJson, workspaceRoot } from '@nx/devkit';
import { retrieveProjectConfigurations } from 'nx/src/project-graph/utils/retrieve-workspace-files';
import { join } from 'path';

function getJestConfigProjectPath(projectJestConfigPath: string): string {
  return join('<rootDir>', projectJestConfigPath);
}

/**
 * Get a list of paths to all the jest config files
 * using the Nx Jest executor.
 *
 * This is used to configure Jest multi-project support.
 *
 * To add a project not using the Nx Jest executor:
 * export default {
 *   projects: [...getJestProjects(), '<rootDir>/path/to/jest.config.ts'];
 * }
 *
 **/
export async function getJestProjects() {
  const nxJson = readNxJson();
  const nxGraph = await retrieveProjectConfigurations(workspaceRoot, nxJson);
  const jestConfigurationSet = new Set<string>();
  for (const projectConfig of Object.values(nxGraph.projects)) {
    if (!projectConfig.targets) {
      continue;
    }
    for (const targetConfig of Object.values(projectConfig.targets)) {
      if (
        targetConfig.executor !== '@nx/jest:jest' &&
        targetConfig.executor !== '@nrwl/jest:jest'
      ) {
        continue;
      }
      if (targetConfig.options?.jestConfig) {
        jestConfigurationSet.add(
          getJestConfigProjectPath(targetConfig.options.jestConfig)
        );
      }
      if (targetConfig.configurations) {
        for (const configurationObject of Object.values(
          targetConfig.configurations
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
