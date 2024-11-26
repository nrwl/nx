import { toProjectName } from '../../config/to-project-name';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { Tree } from '../../generators/tree';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { readJson, writeJson } from '../../generators/utils/json';
import { getProjects } from '../../generators/utils/project-configuration';
import type { PackageJson } from '../../utils/package-json';

export default async function setProjectName(tree: Tree) {
  // We are explicitly looking for project.json files here, so getProjects is fine.
  const projects = getProjects(tree);

  for (const { root } of projects.values()) {
    const projectJsonPath = `${root}/project.json`;
    const packageJsonPath = `${root}/package.json`;

    // If either of these files doesn't exist, theres no behavioral difference
    if (!tree.exists(projectJsonPath) || !tree.exists(packageJsonPath)) {
      continue;
    }

    const projectJson: ProjectConfiguration = readJson(tree, projectJsonPath);

    // In Nx 19.1+, the way the project name is inferred is different.
    // For existing projects, if the name is not set, we can inline it
    // based on the existing logic. This makes sure folks aren't caught
    // off guard by the new behavior.
    if (!projectJson.name) {
      const siblingPackageJson = readJson<PackageJson>(tree, packageJsonPath);

      const newName = siblingPackageJson.nx?.name ?? siblingPackageJson.name;

      const oldName = toProjectName(projectJsonPath);

      if (newName && oldName !== newName) {
        projectJson.name = oldName;
        writeJson(tree, projectJsonPath, projectJson);
      }
    }
  }

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
