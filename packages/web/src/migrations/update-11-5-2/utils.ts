import { ProjectGraph } from '@nrwl/workspace';
import { getProjects } from '@nrwl/devkit';
import { DependencyType } from '@nrwl/workspace/src/core/project-graph';

const cache = new Map<string, boolean>();

export function hasDependentAppUsingWebBuild(
  projectName: string,
  reversedProjectGraph: ProjectGraph,
  projects: ReturnType<typeof getProjects>
) {
  function walk(currProject: string) {
    if (cache.has(currProject)) {
      return cache.get(currProject);
    }
    const project = projects.get(currProject);

    if (project?.targets?.build?.executor === '@nrwl/web:build') {
      cache.set(currProject, true);
      return true;
    }

    const deps = reversedProjectGraph.dependencies[currProject];

    if (deps.length === 0) {
      cache.set(currProject, false);
      return false;
    }

    const result = deps.some(
      (dep) => dep.type !== DependencyType.implicit && walk(dep.target)
    );
    cache.set(currProject, result);
    return result;
  }

  return walk(projectName);
}
