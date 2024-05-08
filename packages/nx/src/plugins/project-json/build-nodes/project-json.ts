import { dirname, join } from 'node:path';

import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { toProjectName } from '../../../config/to-project-name';
import { readJsonFile } from '../../../utils/fileutils';
import { NxPluginV2 } from '../../../project-graph/plugins';
import { CreateNodesError } from '../../../project-graph/error-types';

export const ProjectJsonProjectsPlugin: NxPluginV2 = {
  name: 'nx/core/project-json',
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

export default ProjectJsonProjectsPlugin;

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
