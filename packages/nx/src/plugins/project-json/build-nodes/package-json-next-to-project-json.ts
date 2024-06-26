import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { NxPluginV2 } from '../../../project-graph/plugins';
import { readJsonFile } from '../../../utils/fileutils';
import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import {
  PackageJson,
  getMetadataFromPackageJson,
  getTagsFromPackageJson,
  readTargetsFromPackageJson,
} from '../../../utils/package-json';
import { buildPackageJsonWorkspacesMatcher } from '../../package-json-workspaces';

// TODO: Remove this one day, this should not need to be done.

export const PackageJsonProjectsNextToProjectJsonPlugin: NxPluginV2 = {
  // Its not a problem if plugins happen to have same name, and this
  // will look least confusing in the source map.
  name: 'nx/core/package-json',
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

export default PackageJsonProjectsNextToProjectJsonPlugin;

function createProjectFromPackageJsonNextToProjectJson(
  projectJsonPath: string,
  workspaceRoot: string
): ProjectConfiguration | null {
  const root = dirname(projectJsonPath);
  const relativePackageJsonPath = join(root, 'package.json');
  const packageJsonPath = join(workspaceRoot, relativePackageJsonPath);
  const readJson = (f) => readJsonFile(join(workspaceRoot, f));

  // Do not create projects for package.json files
  // that are part of the package manager workspaces
  // Those package.json files will be processed later on
  const matcher = buildPackageJsonWorkspacesMatcher(workspaceRoot, readJson);

  if (!existsSync(packageJsonPath) || matcher(relativePackageJsonPath)) {
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
      metadata: getMetadataFromPackageJson(packageJson),
      tags: getTagsFromPackageJson(packageJson),
    } as ProjectConfiguration;
  } catch (e) {
    console.log(e);
    return null;
  }
}
