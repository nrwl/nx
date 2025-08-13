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

  try {
    if (!projectGraph) {
      projectGraph = await createProjectGraphAsync({
        exitOnError: false,
        resetDaemonClient: true,
      });
    }
  } catch {
    // ignore
  }

  return projectGraph;
}
