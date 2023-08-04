import { dirname } from 'node:path';

import { ProjectConfiguration } from '../src/config/workspace-json-project-json';
import { toProjectName } from '../src/config/workspaces';
import { readJsonFile } from '../src/utils/fileutils';
import { NxPluginV2 } from '../src/utils/nx-plugin';

export function getProjectJsonPlugin(
  readJson: <T extends Object>(string) => T = <T extends Object>(string) =>
    readJsonFile<T>(string)
): NxPluginV2 {
  // making this an arg allows us to reuse in devkit): NxPluginV2 {
  return {
    name: 'nx-core-build-project-json-nodes',
    projectConfigurationsConstructor:
      // Load projects from project.json files. These will be read second, since
      // they are listed last in the plugin, so they will overwrite things from the package.json
      // based projects.
      [
        '{project.json,**/project.json}',
        (file) => {
          const json = readJson<ProjectConfiguration>(file);
          const project = buildProjectFromProjectJson(json, file);
          return {
            projectNodes: {
              [project.name]: project,
            },
          };
        },
      ],
  };
}

export function buildProjectFromProjectJson(
  json: Partial<ProjectConfiguration>,
  path: string
): ProjectConfiguration {
  return {
    name: toProjectName(path),
    root: dirname(path),
    ...json,
  };
}
