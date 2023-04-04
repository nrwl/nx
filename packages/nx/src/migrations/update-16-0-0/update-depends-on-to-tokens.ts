import {
  getProjects,
  readNxJson,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { Tree } from '../../generators/tree';

export default async function (tree: Tree) {
  updateNxJson(tree);

  const projectsConfigurations = getProjects(tree);
  for (const [projectName, projectConfiguration] of projectsConfigurations) {
    let projectChanged = false;
    for (const [targetName, targetConfiguration] of Object.entries(
      projectConfiguration.targets ?? {}
    )) {
      for (const dependency of targetConfiguration.dependsOn ?? []) {
        if (typeof dependency !== 'string') {
          dependency.projects =
            (dependency.projects as string) === 'self'
              ? '{self}'
              : '{dependencies}';
          projectChanged = true;
        }
      }
    }
    if (projectChanged) {
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  }
}
function updateNxJson(tree: Tree) {
  const nxJson = readNxJson(tree);
  let nxJsonChanged = false;
  for (const [target, defaults] of Object.entries(
    nxJson?.targetDefaults ?? {}
  )) {
    for (const dependency of defaults.dependsOn ?? []) {
      if (typeof dependency !== 'string') {
        dependency.projects =
          (dependency.projects as string) === 'self'
            ? '{self}'
            : '{dependencies}';
        nxJsonChanged = true;
      }
    }
  }
  if (nxJsonChanged) {
    tree.write('nx.json', JSON.stringify(nxJson, null, 2));
  }
}
