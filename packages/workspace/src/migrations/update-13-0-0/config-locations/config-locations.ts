import {
  formatFiles,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';

export default async function update(tree: Tree) {
  const nxJson = readJson(tree, 'nx.json') as NxJsonConfiguration & {
    projects: Record<
      string,
      Pick<ProjectConfiguration, 'tags' | 'implicitDependencies'>
    > | null;
  };
  // updateProjectConfiguration automatically saves the project opts into workspace/project.json
  if (nxJson.projects) {
    Object.entries(nxJson.projects).forEach(([p, nxJsonConfiguration]) => {
      const configuration = readProjectConfiguration(tree, p);
      configuration.tags ??= nxJsonConfiguration.tags;
      configuration.implicitDependencies ??=
        nxJsonConfiguration.implicitDependencies;
      updateProjectConfiguration(tree, p, configuration);
    });
    delete nxJson.projects;
  }

  writeJson(tree, 'nx.json', nxJson);

  movePropertiesAreInNewLocations(tree); // move config options to new spots.

  await formatFiles(tree);
}

/**
 * `updateWorkspaceConfiguration` already handles
 * placing properties in their new locations, so
 * reading + updating it ensures that props are placed
 * correctly.
 */
function movePropertiesAreInNewLocations(tree: Tree) {
  return;
}
