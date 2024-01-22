import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';

export default async function updateFileServerExecutor(tree: Tree) {
  const oldExecutor = '@nrwl/angular:file-server';
  const newExecutor = '@nrwl/web:file-server';
  let needsNrwlWeb = false;

  const nxJson = readNxJson(tree);
  if (nxJson.targetDefaults) {
    let nxJsonChanged = false;

    for (const [targetName, target] of Object.entries(nxJson.targetDefaults)) {
      if (target.executor === oldExecutor) {
        nxJson.targetDefaults[targetName].executor = newExecutor;
        nxJsonChanged = true;
        needsNrwlWeb = true;
      }
    }

    if (nxJsonChanged) {
      updateNxJson(tree, nxJson);
    }
  }

  const projects = getProjects(tree);
  for (const [projectName, project] of projects.entries()) {
    let projectChanged = false;

    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      if (target.executor === oldExecutor) {
        project.targets[targetName].executor = newExecutor;
        projectChanged = true;
        needsNrwlWeb = true;
      }
    }

    if (projectChanged) {
      updateProjectConfiguration(tree, projectName, project);
    }
  }

  if (needsNrwlWeb) {
    addDependenciesToPackageJson(tree, {}, { '@nrwl/web': nxVersion });
  }

  await formatFiles(tree);
}
