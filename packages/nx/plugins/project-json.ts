import { dirname, join } from 'node:path';

import { ProjectConfiguration } from '../src/config/workspace-json-project-json';
import { toProjectName } from '../src/config/workspaces';
import { readJsonFile } from '../src/utils/fileutils';
import { NxPluginV2 } from '../src/utils/nx-plugin';

export function getNxProjectJsonPlugin(root: string): NxPluginV2 {
  return {
    name: 'nx-core-build-project-json-nodes',
    createNodes: [
      '{project.json,**/project.json}',
      (file) => {
        const json = readJsonFile<ProjectConfiguration>(join(root, file));
        const project = buildProjectFromProjectJson(json, file);
        return {
          projects: {
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
