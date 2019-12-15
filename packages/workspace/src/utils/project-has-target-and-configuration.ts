import { ProjectGraphNode } from '@nrwl/workspace/src/core/project-graph';

export function projectHasTargetAndConfiguration(
  project: ProjectGraphNode,
  target: string,
  configuration?: string
) {
  if (
    !project.data ||
    !project.data.architect ||
    !project.data.architect[target]
  ) {
    return false;
  }

  if (!configuration) {
    return !!project.data.architect[target];
  } else {
    return (
      project.data.architect[target].configurations &&
      project.data.architect[target].configurations[configuration]
    );
  }
}
