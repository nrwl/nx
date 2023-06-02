import { ProjectConfiguration, Workspaces } from '@nx/devkit';
import { join } from 'path';
import { tmpProjPath } from './create-project-utils';
import { readJson, updateFile } from './file-utils';

export function updateProjectConfig(
  projectName: string,
  callback: (c: ProjectConfiguration) => ProjectConfiguration
) {
  const workspace = readResolvedConfiguration();
  const root = workspace.projects[projectName].root;
  const path = join(root, 'project.json');
  const current = readJson(path);
  updateFile(path, JSON.stringify(callback(current), null, 2));
}

export function readResolvedConfiguration() {
  process.env.NX_PROJECT_GLOB_CACHE = 'false';
  const ws = new Workspaces(tmpProjPath());
  return ws.readProjectsConfigurations();
}

export function readProjectConfig(projectName: string): ProjectConfiguration {
  const root = readResolvedConfiguration().projects[projectName].root;
  const path = join(root, 'project.json');
  return readJson(path);
}
