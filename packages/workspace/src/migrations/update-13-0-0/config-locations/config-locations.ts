import {
  formatFiles,
  getWorkspacePath,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateNxJson,
  updateProjectConfiguration,
  writeJson,
} from '@nrwl/devkit';

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
  // If nx.json doesn't exist then there is no where to move these properties to
  if (!tree.exists('nx.json')) {
    return;
  }

  const workspacePath = getWorkspacePath(tree);
  if (!workspacePath) {
    return;
  }
  const nxJson = readNxJson(tree);
  updateJson<NxJsonConfiguration>(tree, workspacePath, (json) => {
    nxJson.generators ??= json.generators ?? (json as any).schematics;
    if (nxJson.cli) {
      nxJson.cli.defaultCollection ??= json.cli?.defaultCollection;
      nxJson.cli.packageManager ??= json.cli?.packageManager;
    } else if (json.cli) {
      nxJson.cli ??= json.cli;
    }
    nxJson.defaultProject ??= json.defaultProject;
    delete json.cli;
    delete json.defaultProject;
    delete (json as any).schematics;
    delete json.generators;
    return json;
  });
  updateNxJson(tree, nxJson);
}
