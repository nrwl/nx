import { ProjectGraphCache, readCache } from './nx-deps-cache';
import { buildProjectGraph } from './build-project-graph';
import { readNxJson, workspaceFileName } from './file-utils';
import { output } from '../utils/output';
import { isCI } from '../utils/is-ci';
import { defaultFileHasher } from '../hasher/file-hasher';
import {
  isDaemonDisabled,
  markDaemonAsDisabled,
  writeDaemonLogs,
} from '../daemon/tmp-dir';
import { statSync } from 'fs';
import { ProjectGraph, ProjectGraphV4 } from '../config/project-graph';
import { stripIndents } from '../utils/strip-indents';

/**
 * Synchronously reads the latest cached copy of the workspace's ProjectGraph.
 * @throws {Error} if there is no cached ProjectGraph to read from
 */
export function readCachedProjectGraph(): ProjectGraph {
  const projectGraphCache: ProjectGraphCache | false = readCache();
  const angularSpecificError =
    workspaceFileName() === 'angular.json'
      ? stripIndents`
      Make sure invoke 'node ./decorate-angular-cli.js' in your postinstall script.
      The decorated CLI will compute the project graph.
      'ng --help' should say 'Smart, Fast and Extensible Build System'.
      `
      : '';
  if (!projectGraphCache) {
    throw new Error(stripIndents`
      [readCachedProjectGraph] ERROR: No cached ProjectGraph is available.

      If you are leveraging \`readCachedProjectGraph()\` directly then you will need to refactor your usage to first ensure that
      the ProjectGraph is created by calling \`await createProjectGraphAsync()\` somewhere before attempting to read the data.

      If you encounter this error as part of running standard \`nx\` commands then please open an issue on https://github.com/nrwl/nx

      ${angularSpecificError}
    `);
  }
  const projectGraph = {
    version: projectGraphCache.version,
    nodes: projectGraphCache.nodes,
    externalNodes: projectGraphCache.externalNodes,
    dependencies: projectGraphCache.dependencies,
  } as ProjectGraph;

  return projectGraphAdapter(
    projectGraph.version,
    '5.0',
    projectGraph
  ) as ProjectGraph;
}

async function buildProjectGraphWithoutDaemon() {
  await defaultFileHasher.ensureInitialized();
  return await buildProjectGraph();
}

/**
 * Computes and returns a ProjectGraph.
 *
 * Nx will compute the graph either in a daemon process or in the current process.
 *
 * Nx will compute it in the current process if:
 * * The process is running in CI (CI env variable is to true or other common variables used by CI providers are set).
 * * It is running in the docker container.
 * * The daemon process is disabled because of the previous error when starting the daemon.
 * * `NX_DAEMON` is set to `false`.
 * * `useDaemon` is set to false in `nx.json`
 *
 * `NX_DAEMON` env variable takes precedence:
 * * If it is set to true, the daemon will always be used.
 * * If it is set to false, the graph will always be computed in the current process.
 *
 * Tip: If you want to debug project graph creation, run your command with NX_DAEMON=false.
 *
 * Nx uses two layers of caching: the information about explicit dependencies stored on the disk and the information
 * stored in the daemon process. To reset both run: `nx reset`.
 */
export async function createProjectGraphAsync(): Promise<ProjectGraph> {
  const nxJson = readNxJson();
  const useDaemonProcessOption =
    nxJson.tasksRunnerOptions?.['default']?.options?.useDaemonProcess;
  const env = process.env.NX_DAEMON;

  // env takes precedence
  // option=true,env=false => no daemon
  // option=false,env=undefined => no daemon
  // option=false,env=false => no daemon

  // option=undefined,env=undefined => daemon
  // option=true,env=true => daemon
  // option=false,env=true => daemon
  if (
    isCI() ||
    isDocker() ||
    isDaemonDisabled() ||
    (useDaemonProcessOption === undefined && env === 'false') ||
    (useDaemonProcessOption === true && env === 'false') ||
    (useDaemonProcessOption === false && env === undefined) ||
    (useDaemonProcessOption === false && env === 'false')
  ) {
    return await buildProjectGraphWithoutDaemon();
  } else {
    try {
      const daemonClient = require('../daemon/client/client');
      if (!(await daemonClient.isServerAvailable())) {
        await daemonClient.startInBackground();
      }
      return daemonClient.getProjectGraphFromServer();
    } catch (e) {
      if (e.message.indexOf('inotify_add_watch') > -1) {
        // common errors with the daemon due to OS settings (cannot watch all the files available)
        output.note({
          title: `Unable to start Nx Daemon due to the limited amount of inotify watches, continuing without the daemon.`,
          bodyLines: [
            'For more information read: https://askubuntu.com/questions/1088272/inotify-add-watch-failed-no-space-left-on-device',
            'Nx Daemon is going to be disabled until you run "nx reset".',
          ],
        });
      } else {
        const errorLogFile = writeDaemonLogs(e.message);
        output.warn({
          title: `Nx Daemon was not able to compute the project graph.`,
          bodyLines: [
            `Log file with the error: ${errorLogFile}`,
            `Please file an issue at https://github.com/nrwl/nx`,
            'Nx Daemon is going to be disabled until you run "nx reset".',
          ],
        });
      }
      markDaemonAsDisabled();
      return buildProjectGraphWithoutDaemon();
    }
  }
}

function isDocker() {
  try {
    statSync('/.dockerenv');
    return true;
  } catch {
    return false;
  }
}

function printErrorMessage(e: any) {
  const lines = e.message.split('\n');
  output.error({
    title: lines[0],
    bodyLines: lines.slice(1),
  });
}

/**
 * Backwards compatibility adapter for project graph
 * @param {string} sourceVersion
 * @param {string} targetVersion
 * @param projectGraph
 * @param {ProjectGraph} projectGraph
 * @returns {ProjectGraph}
 */
export function projectGraphAdapter(
  sourceVersion: string,
  targetVersion: string,
  projectGraph: ProjectGraph
): ProjectGraph | ProjectGraphV4 {
  if (sourceVersion === targetVersion) {
    return projectGraph;
  }
  if (sourceVersion === '5.0' && targetVersion === '4.0') {
    return projectGraphCompat5to4(projectGraph as ProjectGraph);
  }
  throw new Error(
    `Invalid source or target versions. Source: ${sourceVersion}, Target: ${targetVersion}.

Only backwards compatibility between "5.0" and "4.0" is supported.
This error can be caused by "@nrwl/..." packages getting out of sync or outdated project graph cache.
Check the versions running "nx report" and/or remove your "nxdeps.json" file (in node_modules/.cache/nx folder).
    `
  );
}

/**
 * Backwards compatibility adapter for project Nodes v4 to v5
 * @param {ProjectGraph} projectGraph
 * @returns {ProjectGraph}
 */
function projectGraphCompat5to4(projectGraph: ProjectGraph): ProjectGraphV4 {
  const { externalNodes, ...rest } = projectGraph;
  return {
    ...rest,
    nodes: {
      ...projectGraph.nodes,
      ...externalNodes,
    },
    dependencies: {
      ...projectGraph.dependencies,
      ...Object.keys(externalNodes).reduce(
        (acc, key) => ({ ...acc, [`npm:${key}`]: [] }),
        {}
      ),
    },
    version: '4.0',
  };
}
