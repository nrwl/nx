import { Schema } from './schema';
import {
  Tree,
  formatFiles,
  joinPathFragments,
  getProjects,
  writeJson,
  logger,
  getWorkspacePath,
  convertNxGenerator,
} from '@nrwl/devkit';

export async function createWorkspaceJson(host: Tree, schema: Schema) {
  if (host.exists('angular.json') || host.exists('workspace.json')) {
    logger.warn(
      'Existing workspace config file found: ' + getWorkspacePath(host)
    );
    return;
  }
  const projects = Array.from(getProjects(host).entries());
  writeJson(host, 'workspace.json', {
    version: 2,
    projects: Object.fromEntries(
      projects.map(([project, config]) => [project, config.root])
    ),
  });
  projects.forEach(([, config]) => {
    writeJson(host, joinPathFragments(config.root, 'project.json'), config);
  });

  if (!schema.skipFormat) {
    await formatFiles(host);
  }
}

export default createWorkspaceJson;

export const compat = convertNxGenerator(createWorkspaceJson);
