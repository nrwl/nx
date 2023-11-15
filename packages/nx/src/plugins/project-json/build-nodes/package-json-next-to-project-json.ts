import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { NxPluginV2 } from '../../../utils/nx-plugin';
import { readJsonFile } from '../../../utils/fileutils';
import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import {
  PackageJson,
  readTargetsFromPackageJson,
} from '../../../utils/package-json';

// TODO: Remove this one day, this should not need to be done.

export const CreatePackageJsonProjectsNextToProjectJson: NxPluginV2 = {
  name: 'nx-core-build-package-json-nodes-next-to-project-json-nodes',
  createNodes: [
    '{project.json,**/project.json}',
    (file, _, { workspaceRoot }) => {
      const project = createProjectFromPackageJsonNextToProjectJson(
        file,
        workspaceRoot
      );

      return project
        ? {
            projects: {
              [project.name]: project,
            },
          }
        : {};
    },
  ],
};

function createProjectFromPackageJsonNextToProjectJson(
  projectJsonPath: string,
  workspaceRoot: string
): ProjectConfiguration | null {
  const root = dirname(projectJsonPath);
  const packageJsonPath = join(workspaceRoot, root, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  try {
    const packageJson: PackageJson = readJsonFile(packageJsonPath);

    let { nx, name } = packageJson;

    return {
      ...nx,
      name,
      root,
      targets: readTargetsFromPackageJson(packageJson),
    } as ProjectConfiguration;
  } catch (e) {
    console.log(e);
    return null;
  }
}
