import { Dependency, Deps } from './deps-calculator';

export enum ProjectType {
  app = 'app',
  e2e = 'e2e',
  lib = 'lib'
}

export type ProjectNode = {
  name: string;
  root: string;
  type: ProjectType;
  tags: string[];
  files: string[];
  architect: { [k: string]: any };
  implicitDependencies: string[];
  fileMTimes: {
    [filePath: string]: number;
  };
};

export type AffectedFetcher = (
  projects: ProjectNode[],
  dependencies: Deps,
  touchedProjects: string[]
) => string[];

export function affectedAppNames(
  projects: ProjectNode[],
  dependencies: Deps,
  touchedProjects: string[]
): string[] {
  return affectedProjects(projects, dependencies, touchedProjects)
    .filter(p => p.type === ProjectType.app)
    .map(p => p.name);
}

export function affectedLibNames(
  projects: ProjectNode[],
  dependencies: Deps,
  touchedProjects: string[]
): string[] {
  return affectedProjects(projects, dependencies, touchedProjects)
    .filter(p => p.type === ProjectType.lib)
    .map(p => p.name);
}

export function affectedProjectNames(
  projects: ProjectNode[],
  dependencies: Deps,
  touchedProjects: string[]
): string[] {
  return affectedProjects(projects, dependencies, touchedProjects).map(
    p => p.name
  );
}

export function affectedProjectNamesWithTarget(
  target: string
): AffectedFetcher {
  return (
    projects: ProjectNode[],
    dependencies: Deps,
    touchedProjects: string[]
  ) => {
    return affectedProjects(projects, dependencies, touchedProjects)
      .filter(p => p.architect[target])
      .map(p => p.name);
  };
}

function affectedProjects(
  projects: ProjectNode[],
  dependencies: Deps,
  touchedProjects: string[]
) {
  return projects.filter(proj =>
    hasDependencyOnTouchedProjects(proj.name, touchedProjects, dependencies, [])
  );
}

function hasDependencyOnTouchedProjects(
  project: string,
  touchedProjects: string[],
  deps: { [projectName: string]: Dependency[] },
  visisted: string[]
) {
  if (touchedProjects.indexOf(project) > -1) return true;
  if (visisted.indexOf(project) > -1) return false;
  return (
    deps[project]
      .map(d => d.projectName)
      .filter(k =>
        hasDependencyOnTouchedProjects(
          k,
          touchedProjects,
          deps,
          [...visisted, project]
        )
      ).length > 0
  );
}
