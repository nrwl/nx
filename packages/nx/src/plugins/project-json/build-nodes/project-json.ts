import { dirname, join } from 'node:path';

import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { readJsonFile } from '../../../utils/fileutils';
import { createNodesFromFiles, NxPlugin } from '../../../project-graph/plugins';

export const ProjectJsonProjectsPlugin: NxPlugin = {
  name: 'nx/core/project-json',
  createNodes: [
    '{project.json,**/project.json}',
    (configFiles, _, context) => {
      return createNodesFromFiles(
        (file) => {
          const json = readJsonFile<ProjectConfiguration>(
            join(context.workspaceRoot, file)
          );

          const project = buildProjectFromProjectJson(json, file);

          return {
            projects: {
              [project.root]: project,
            },
          };
        },
        configFiles,
        _,
        context
      );
    },
  ],
};

export default ProjectJsonProjectsPlugin;

export function buildProjectFromProjectJson(
  json: Partial<ProjectConfiguration>,
  path: string
): ProjectConfiguration {
  const { name, root, ...rest } = json;
  return {
    name,
    root: root ?? dirname(path),
    ...rest,
  };
}
