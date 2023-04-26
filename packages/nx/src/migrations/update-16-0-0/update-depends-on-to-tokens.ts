import {
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { Tree } from '../../generators/tree';

export default async function (tree: Tree) {
  updateDependsOnInsideNxJson(tree);

  const projectsConfigurations = getProjects(tree);
  for (const [projectName, projectConfiguration] of projectsConfigurations) {
    let projectChanged = false;
    for (const [targetName, targetConfiguration] of Object.entries(
      projectConfiguration.targets ?? {}
    )) {
      for (const dependency of targetConfiguration.dependsOn ?? []) {
        if (typeof dependency !== 'string') {
          if (dependency.projects === 'self') {
            dependency.projects = '{self}';
            projectChanged = true;
          } else if (dependency.projects === 'dependencies') {
            dependency.projects = '{dependencies}';
            projectChanged = true;
          }
        }
      }
    }
    if (projectChanged) {
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  }
}
function updateDependsOnInsideNxJson(tree: Tree) {
  const nxJson = readNxJson(tree);
  let nxJsonChanged = false;
  for (const [target, defaults] of Object.entries(
    nxJson?.targetDefaults ?? {}
  )) {
    for (const dependency of defaults.dependsOn ?? []) {
      if (typeof dependency !== 'string') {
        if (dependency.projects === 'self') {
          dependency.projects = '{self}';
          nxJsonChanged = true;
        } else if (dependency.projects === 'dependencies') {
          dependency.projects = '{dependencies}';
          nxJsonChanged = true;
        }
      }
    }
  }
  if (nxJsonChanged) {
    updateNxJson(tree, nxJson);
  }
}
