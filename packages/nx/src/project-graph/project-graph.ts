import {
  readProjectFileMapCache,
  readProjectGraphCache,
} from './nx-deps-cache';
import { buildProjectGraphUsingProjectFileMap } from './build-project-graph';
import { output } from '../utils/output';
import { markDaemonAsDisabled, writeDaemonLogs } from '../daemon/tmp-dir';
import { ProjectGraph } from '../config/project-graph';
import { stripIndents } from '../utils/strip-indents';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../config/workspace-json-project-json';
import { daemonClient } from '../daemon/client/client';
import { fileExists } from '../utils/fileutils';
import { workspaceRoot } from '../utils/workspace-root';
import { performance } from 'perf_hooks';
import { retrieveWorkspaceFiles } from './utils/retrieve-workspace-files';
import { readNxJson } from './file-utils';

/**
 * Synchronously reads the latest cached copy of the workspace's ProjectGraph.
 * @throws {Error} if there is no cached ProjectGraph to read from
 */
export function readCachedProjectGraph(): ProjectGraph {
  const projectGraphCache: ProjectGraph = readProjectGraphCache();
  const angularSpecificError = fileExists(`${workspaceRoot}/angular.json`)
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
  return projectGraphCache;
}

export function readCachedProjectConfiguration(
  projectName: string
): ProjectConfiguration {
  const graph = readCachedProjectGraph();
  const node = graph.nodes[projectName];
  return node.data;
}

export function readProjectsConfigurationFromProjectGraph(
  projectGraph: ProjectGraph
): ProjectsConfigurations {
  return {
    projects: Object.fromEntries(
      Object.entries(projectGraph.nodes).map(([project, { data }]) => [
        project,
        data,
      ])
    ),
    version: 2,
  };
}

export async function buildProjectGraphWithoutDaemon() {
  const nxJson = readNxJson();

  const { allWorkspaceFiles, projectFileMap, projectConfigurations } =
    await retrieveWorkspaceFiles(workspaceRoot, nxJson);

  const cacheEnabled = process.env.NX_CACHE_PROJECT_GRAPH !== 'false';
  return (
    await buildProjectGraphUsingProjectFileMap(
      projectConfigurations,
      projectFileMap,
      allWorkspaceFiles,
      cacheEnabled ? readProjectFileMapCache() : null,
      cacheEnabled
    )
  ).projectGraph;
}

function handleProjectGraphError(opts: { exitOnError: boolean }, e) {
  if (opts.exitOnError) {
    const lines = e.message.split('\n');
    output.error({
      title: lines[0],
      bodyLines: lines.slice(1),
    });
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.error(e);
    }
    process.exit(1);
  } else {
    throw e;
  }
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
export async function createProjectGraphAsync(
  opts: { exitOnError: boolean; resetDaemonClient?: boolean } = {
    exitOnError: false,
    resetDaemonClient: false,
  }
): Promise<ProjectGraph> {
  performance.mark('create-project-graph-async:start');

  if (!daemonClient.enabled()) {
    try {
      const res = await buildProjectGraphWithoutDaemon();
      performance.mark('create-project-graph-async:end');
      performance.measure(
        'create-project-graph-async',
        'create-project-graph-async:start',
        'create-project-graph-async:end'
      );
      return res;
    } catch (e) {
      handleProjectGraphError(opts, e);
    }
  } else {
    try {
      const projectGraph = await daemonClient.getProjectGraph();
      if (opts.resetDaemonClient) {
        daemonClient.reset();
      }
      performance.mark('create-project-graph-async:end');
      performance.measure(
        'create-project-graph-async',
        'create-project-graph-async:start',
        'create-project-graph-async:end'
      );
      return projectGraph;
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
        markDaemonAsDisabled();
        return buildProjectGraphWithoutDaemon();
      }

      if (e.internalDaemonError) {
        const errorLogFile = writeDaemonLogs(e.message);
        output.warn({
          title: `Nx Daemon was not able to compute the project graph.`,
          bodyLines: [
            `Log file with the error: ${errorLogFile}`,
            `Please file an issue at https://github.com/nrwl/nx`,
            'Nx Daemon is going to be disabled until you run "nx reset".',
          ],
        });
        markDaemonAsDisabled();
        return buildProjectGraphWithoutDaemon();
      }

      handleProjectGraphError(opts, e);
    }
  }
}
