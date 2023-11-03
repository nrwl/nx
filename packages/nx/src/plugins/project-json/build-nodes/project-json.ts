import { dirname, join } from 'node:path';

import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { toProjectName } from '../../../config/workspaces';
import { readJsonFile } from '../../../utils/fileutils';
import { NxPluginV2 } from '../../../utils/nx-plugin';

export const CreateProjectJsonProjectsPlugin: NxPluginV2 = {
  name: 'nx-core-build-project-json-nodes',
  createNodes: [
    '{project.json,**/project.json}',
    (file, _, context) => {
      const root = context.workspaceRoot;
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
