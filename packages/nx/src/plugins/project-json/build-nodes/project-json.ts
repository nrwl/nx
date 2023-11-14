import { dirname, join } from 'node:path';

import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { toProjectName } from '../../../config/workspaces';
import { readJsonFile } from '../../../utils/fileutils';
import { CreateNodes, NxPluginV2 } from '../../../utils/nx-plugin';

export const CreateProjectJsonProjectsPlugin: NxPluginV2<void, CreateNodes> = {
  name: 'nx-core-build-project-json-nodes',
  createNodes: [
    '{project.json,**/project.json}',
    (file, _, { workspaceRoot }) => {
      const json = readJsonFile<ProjectConfiguration>(
        join(workspaceRoot, file)
      );
      const project = buildProjectFromProjectJson(json, file);
      return {
        projects: {
          [project.root]: project,
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
