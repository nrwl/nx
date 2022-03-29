import { getProjects, Tree } from '@nrwl/devkit';
import { MigrationProjectConfiguration, WorkspaceProjects } from './types';

export function getAllProjects(tree: Tree): WorkspaceProjects {
  const projects = getProjects(tree);
  const result: WorkspaceProjects = {
    apps: [],
    libs: [],
  };

  for (const [name, project] of projects) {
    const migrationProject: MigrationProjectConfiguration = {
      config: project,
      name,
    };

    if (project.projectType === 'library') {
      result.libs.push(migrationProject);
    } else {
      result.apps.push(migrationProject);
    }
  }

  return result;
}
