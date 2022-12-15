import {
  formatFiles,
  getWorkspacePath,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  updateWorkspaceConfiguration,
  WorkspaceConfiguration,
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
    Object.entries(nxJson.projects).forEach(([p, nxJsonConfig]) => {
      const configuration = readProjectConfiguration(tree, p);
      configuration.tags ??= nxJsonConfig.tags;
      configuration.implicitDependencies ??= nxJsonConfig.implicitDependencies;
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
  const wc = readWorkspaceConfiguration(tree);
  updateJson<WorkspaceConfiguration>(tree, workspacePath, (json) => {
    wc.generators ??= json.generators ?? (json as any).schematics;
    if (wc.cli) {
      wc.cli.defaultCollection ??= json.cli?.defaultCollection;
      wc.cli.packageManager ??= json.cli?.packageManager;
    } else if (json.cli) {
      wc.cli ??= json.cli;
    }
    wc.defaultProject ??= json.defaultProject;
    delete json.cli;
    delete json.defaultProject;
    delete (json as any).schematics;
    delete json.generators;
    return json;
  });
  updateWorkspaceConfiguration(tree, wc);
}
