import { ProjectConfiguration } from '@nx/devkit';
import { join } from 'path';
import { tmpProjPath } from './create-project-utils';
import { readJson, updateFile } from './file-utils';
import { retrieveProjectConfigurations } from '../../packages/nx/src/project-graph/utils/retrieve-workspace-files';
import { readNxJson } from '../../packages/nx/src/config/nx-json';

export async function updateProjectConfig(
  projectName: string,
  callback: (c: ProjectConfiguration) => ProjectConfiguration
) {
  const projects = await readResolvedConfiguration();
  const root = projects[projectName].root;
  const path = join(root, 'project.json');
  const current = readJson(path);
  updateFile(path, JSON.stringify(callback(current), null, 2));
}

export async function readResolvedConfiguration(): Promise<
  Record<string, ProjectConfiguration>
> {
  process.env.NX_PROJECT_GLOB_CACHE = 'false';
  const root = tmpProjPath();
  return (await retrieveProjectConfigurations(root, readNxJson(root)))
    .projectNodes;
}

export async function readProjectConfig(
  projectName: string
): Promise<ProjectConfiguration> {
  const root = (await readResolvedConfiguration())[projectName].root;
  const path = join(root, 'project.json');
  return readJson(path);
}
