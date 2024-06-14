import { dirname, join } from 'node:path';

import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { toProjectName } from '../../../config/to-project-name';
import { readJsonFile } from '../../../utils/fileutils';
import { NxPluginV2 } from '../../../project-graph/plugins';
import { PackageJson } from '../../../utils/package-json';

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
  const packageJsonPath = join(dirname(path), 'package.json');
  const { name, root, ...rest } = json;
  return {
    name:
      name ?? readNameFromPackageJson(packageJsonPath) ?? toProjectName(path),
    root: root ?? dirname(path),
    ...rest,
  };
}

export function readNameFromPackageJson(path: string): string {
  try {
    const json = readJsonFile<PackageJson>(path);
    return json.nx?.name ?? json.name;
  } catch {
    return undefined;
  }
}
