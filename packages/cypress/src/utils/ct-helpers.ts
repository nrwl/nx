import type { ExecutorContext } from 'nx/src/config/misc-interfaces';
import { ProjectGraph } from 'nx/src/config/project-graph';
import { join } from 'path';

/**
 * return a path to a temp css file
 * temp file is scoped to the project root
 * i.e. <context.root>/tmp/<project-root>/ct-styles.css
 */
export function getTempTailwindPath(context: ExecutorContext) {
  if (!context.projectName) {
    throw new Error('No project name found in context');
  }
  const project = context?.projectGraph.nodes[context.projectName];

  if (!project) {
    throw new Error(
      `No project found in project graph for ${context.projectName}`
    );
  }

  if (project?.data?.root) {
    return join(context.root, 'tmp', project.data.root, 'ct-styles.css');
  }
}

/**
 * also returns true if the ct project and build project are the same.
 * i.e. component testing inside an app.
 */
export function isCtProjectUsingBuildProject(
  graph: ProjectGraph,
  parentProjectName: string,
  childProjectName: string
) {
  return (
    parentProjectName === childProjectName ||
    graph.dependencies[parentProjectName].some(
      (p) => p.target === childProjectName
    )
  );
}
