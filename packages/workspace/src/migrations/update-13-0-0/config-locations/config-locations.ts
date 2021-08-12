/* eslint-disable @typescript-eslint/no-unused-vars */
import { NxJsonConfiguration, NxJsonProjectConfiguration, readNxJson, readProjectConfiguration, readWorkspaceConfiguration, Tree, updateProjectConfiguration } from '@nrwl/devkit';
import { writeJson } from 'fs-extra';

export default function update(host: Tree) {
  const { generators, cli } = readWorkspaceConfiguration(host);
  const nxJson = readNxJson(host) as NxJsonConfiguration & {projects: Record<string, NxJsonProjectConfiguration>};
  nxJson.generators ??= generators;
  nxJson.cli ??= cli;

  // updateProjectConfiguration automatically saves the project opts into workspace/project.json
  Object.keys(nxJson.projects).forEach((p) => {
      updateProjectConfiguration(host, p, readProjectConfiguration(host, p));
  })

  delete nxJson.projects;

  writeJson('nx.json', nxJson);
}
