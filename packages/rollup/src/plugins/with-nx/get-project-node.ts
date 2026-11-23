import { ProjectGraphProjectNode, readCachedProjectGraph } from '@nx/devkit';

export function getProjectNode(): ProjectGraphProjectNode {
  // During graph construction, project is not necessary. Return a stub.
  if (global.NX_GRAPH_CREATION) {
    return {
      type: 'lib',
      name: '',
      data: {
        root: '',
      },
    };
  } else {
    const projectGraph = readCachedProjectGraph();
    const projectName = process.env.NX_TASK_TARGET_PROJECT;
    const projectNode = projectName
      ? projectGraph.nodes[projectName]
      : undefined;
    if (!projectNode) {
      throw new Error(
        `Cannot find project "${projectName}" in the project graph.`
      );
    }
    return projectNode;
  }
}
