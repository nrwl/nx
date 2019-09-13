import { AffectedMetadata, ProjectNode, ProjectType } from './shared';

export function getAffectedApps(affectedMetadata: AffectedMetadata): string[] {
  return filterAffectedMetadata(
    affectedMetadata,
    project =>
      affectedMetadata.projectStates[project.name].affected &&
      project.type === ProjectType.app
  ).map(project => project.name);
}

export function getAffectedLibs(affectedMetadata: AffectedMetadata): string[] {
  return filterAffectedMetadata(
    affectedMetadata,
    project =>
      affectedMetadata.projectStates[project.name].affected &&
      project.type === ProjectType.lib
  ).map(project => project.name);
}
export function getAffectedProjects(
  affectedMetadata: AffectedMetadata
): string[] {
  return filterAffectedMetadata(
    affectedMetadata,
    project => affectedMetadata.projectStates[project.name].affected
  ).map(project => project.name);
}

export function getAffectedProjectsWithTargetAndConfiguration(
  affectedMetadata: AffectedMetadata,
  target: string,
  configuration?: string
): ProjectNode[] {
  return filterAffectedMetadata(
    affectedMetadata,
    project =>
      affectedMetadata.projectStates[project.name].affected &&
      projectHasTargetAndConfiguration(project, target, configuration)
  );
}

export function getAllApps(affectedMetadata: AffectedMetadata): string[] {
  return filterAffectedMetadata(
    affectedMetadata,
    project => project.type === ProjectType.app
  ).map(project => project.name);
}

export function getAllLibs(affectedMetadata: AffectedMetadata): string[] {
  return filterAffectedMetadata(
    affectedMetadata,
    project => project.type === ProjectType.lib
  ).map(project => project.name);
}

export function getAllProjects(affectedMetadata: AffectedMetadata): string[] {
  return filterAffectedMetadata(affectedMetadata, () => true).map(
    project => project.name
  );
}

export function getAllProjectsWithTargetAndConfiguration(
  affectedMetadata: AffectedMetadata,
  target: string,
  configuration?: string
): ProjectNode[] {
  return filterAffectedMetadata(affectedMetadata, project =>
    projectHasTargetAndConfiguration(project, target, configuration)
  );
}

export function projectHasTargetAndConfiguration(
  project: ProjectNode,
  target: string,
  configuration?: string
) {
  if (!project.architect[target]) {
    return false;
  }

  if (!configuration) {
    return !!project.architect[target];
  } else {
    return (
      project.architect[target].configurations &&
      project.architect[target].configurations[configuration]
    );
  }
}

function filterAffectedMetadata(
  affectedMetadata: AffectedMetadata,
  predicate: (project) => boolean
): ProjectNode[] {
  const projects: ProjectNode[] = [];
  visit(affectedMetadata, project => {
    if (predicate(project)) {
      projects.push(project);
    }
  });
  return projects;
}
function visit(
  affectedMetadata: AffectedMetadata,
  visitor: (project: ProjectNode) => void
) {
  const visited = new Set<string>();
  function _visit(projectName: string) {
    affectedMetadata.dependencyGraph.dependencies[projectName].forEach(dep => {
      _visit(dep.projectName);
    });
    if (visited.has(projectName)) {
      return;
    }
    visited.add(projectName);
    visitor(affectedMetadata.dependencyGraph.projects[projectName]);
  }
  affectedMetadata.dependencyGraph.roots.forEach(root => {
    _visit(root);
  });
}
