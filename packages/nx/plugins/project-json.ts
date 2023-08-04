import { dirname, join } from 'node:path';

import { ProjectConfiguration } from '../src/config/workspace-json-project-json';
import { toProjectName } from '../src/config/workspaces';
import { readJsonFile } from '../src/utils/fileutils';
import { NxPluginV2 } from '../src/utils/nx-plugin';
import { workspaceRoot } from '../src/utils/workspace-root';

export const NX_PROJECT_JSON_PLUGIN: NxPluginV2 = {
  name: 'nx-core-build-project-json-nodes',
  projectConfigurationsConstructor: [
    '{project.json,**/project.json}',
    (file) => {
      const json = readJsonFile<ProjectConfiguration>(
        join(workspaceRoot, file)
      );
      const project = buildProjectFromProjectJson(json, file);
      return {
        projectNodes: {
          [project.name]: project,
        },
      };
    },
  ],
};

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
