import { ProjectConfiguration } from 'nx/src/config/workspace-json-project-json';

export function getTargetProject(
  projectName: string,
  projects: Map<string, ProjectConfiguration>
) {
  let project: ProjectConfiguration;
  if (projectName && !projects.has(projectName)) {
    throw new Error(
      `Project (${projectName}) does not exist in the workspace! Please provide a valid project name.`
    );
  } else if (projectName && projects.has(projectName)) {
    project = projects.get(projectName);
  }
  return project;
}
