import { logger, ProjectGraph } from '@nrwl/devkit';
import { ProjectGraphCache, readCache } from '../nx-deps/nx-deps-cache';
import {
  buildProjectGraph,
  projectGraphCompat4to3,
  projectGraphMigrate3to4,
} from './build-project-graph';

/**
 * Synchronously reads the latest cached copy of the workspace's ProjectGraph.
 * @throws {Error} if there is no cached ProjectGraph to read from
 */
export function readCachedProjectGraph(
  projectGraphVersion = '3.0'
): ProjectGraph {
  const projectGraphCache: ProjectGraphCache | false = readCache();
  if (!projectGraphCache) {
    throw new Error(`
      [readCachedProjectGraph] ERROR: No cached ProjectGraph is available.

      If you are leveraging \`readCachedProjectGraph()\` directly then you will need to refactor your usage to first ensure that
      the ProjectGraph is created by calling \`await createProjectGraphAsync()\` somewhere before attempting to read the data.

      If you encounter this error as part of running standard \`nx\` commands then please open an issue on https://github.com/nrwl/nx
    `);
  }
  let projectGraph: ProjectGraph = {
    version: projectGraphCache.version,
    nodes: projectGraphCache.nodes,
    dependencies: projectGraphCache.dependencies,
  };
  if (projectGraphVersion !== projectGraph.version) {
    projectGraph =
      projectGraphVersion === '3.0'
        ? projectGraphCompat4to3(projectGraph)
        : projectGraphMigrate3to4(projectGraph);
  }
  return projectGraph;
}

export async function createProjectGraphAsync(
  projectGraphVersion = '3.0'
): Promise<ProjectGraph> {
  /**
   * Using the daemon is currently an undocumented, opt-in feature while we build out its capabilities.
   * If the environment variable is not set to true, fallback to using the existing in-process logic.
   */
  if (process.env.NX_DAEMON !== 'true') {
    return buildProjectGraph(projectGraphVersion);
  }

  const daemonClient = require('./daemon/client/client');
  if (!(await daemonClient.isServerAvailable())) {
    await daemonClient.startInBackground();
  }

  return daemonClient.getProjectGraphFromServer();
}
