import { ProjectGraphNode } from '../core/project-graph/project-graph-models';

export function projectHasTarget(project: ProjectGraphNode, target: string) {
  return project.data && project.data.targets && project.data.targets[target];
}

export function projectHasTargetAndConfiguration(
  project: ProjectGraphNode,
  target: string,
  configuration: string
) {
  return (
    projectHasTarget(project, target) &&
    project.data.targets[target].configurations &&
    project.data.targets[target].configurations[configuration]
  );
}
