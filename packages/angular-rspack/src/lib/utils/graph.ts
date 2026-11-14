import {
  createProjectGraphAsync,
  readCachedProjectGraph,
  type ProjectGraph,
} from '@nx/devkit';

export async function retrieveOrCreateProjectGraph(): Promise<ProjectGraph | null> {
  let projectGraph: ProjectGraph | null = null;
  try {
    projectGraph = readCachedProjectGraph();
  } catch {
    // ignore
  }

  // A failed nx graph build can leave NX_GRAPH_CREATION set, for example
  // when a plugin doesn't load.
  const hadGraphCreationFlag = 'NX_GRAPH_CREATION' in global;
  const graphCreationFlag = global.NX_GRAPH_CREATION;
  try {
    if (!projectGraph) {
      projectGraph = await createProjectGraphAsync({
        exitOnError: false,
        resetDaemonClient: true,
      });
    }
  } catch {
    // ignore
  } finally {
    if (hadGraphCreationFlag) {
      global.NX_GRAPH_CREATION = graphCreationFlag;
    } else {
      delete global.NX_GRAPH_CREATION;
    }
  }

  return projectGraph;
}
