import { performance } from 'perf_hooks';

import { readNxJson } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../config/workspace-json-project-json';
import { daemonClient } from '../daemon/client/client';
import { markDaemonAsDisabled, writeDaemonLogs } from '../daemon/tmp-dir';
import { fileExists } from '../utils/fileutils';
import { output } from '../utils/output';
import { stripIndents } from '../utils/strip-indents';
import { workspaceRoot } from '../utils/workspace-root';
import {
  buildProjectGraphUsingProjectFileMap,
  hydrateFileMap,
} from './build-project-graph';
import {
  AggregateProjectGraphError,
  isAggregateProjectGraphError,
  ProjectConfigurationsError,
  ProjectGraphError,
} from './error-types';
import {
  readFileMapCache,
  readProjectGraphCache,
  readSourceMapsCache,
  writeCache,
} from './nx-deps-cache';
import { ConfigurationResult } from './utils/project-configuration-utils';
import {
  retrieveProjectConfigurations,
  retrieveWorkspaceFiles,
} from './utils/retrieve-workspace-files';
import { getPlugins } from './plugins/get-plugins';
import { logger } from '../utils/logger';
import { FileLock } from '../utils/file-lock';
import { join } from 'path';
import { workspaceDataDirectory } from '../utils/cache-directory';

/**
 * Synchronously reads the latest cached copy of the workspace's ProjectGraph.
 * @throws {Error} if there is no cached ProjectGraph to read from
 */
export function readCachedProjectGraph(): ProjectGraph {
  const projectGraphCache: ProjectGraph = readProjectGraphCache();
  if (!projectGraphCache) {
    const angularSpecificError = fileExists(`${workspaceRoot}/angular.json`)
      ? stripIndents`
      Make sure invoke 'node ./decorate-angular-cli.js' in your postinstall script.
      The decorated CLI will compute the project graph.
      'ng --help' should say 'Smart Monorepos · Fast CI'.
      `
      : '';

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
  try {
    return node.data;
  } catch (e) {
    throw new Error(`Cannot find project: '${projectName}' in your workspace.`);
  }
}

/**
 * Get the {@link ProjectsConfigurations} from the {@link ProjectGraph}
 */
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

export async function buildProjectGraphAndSourceMapsWithoutDaemon() {
  global.NX_GRAPH_CREATION = true;
  const nxJson = readNxJson();

  performance.mark('retrieve-project-configurations:start');
  let configurationResult: ConfigurationResult;
  let projectConfigurationsError: ProjectConfigurationsError;
  const plugins = await getPlugins();
  try {
    configurationResult = await retrieveProjectConfigurations(
      plugins,
      workspaceRoot,
      nxJson
    );
  } catch (e) {
    if (e instanceof ProjectConfigurationsError) {
      projectConfigurationsError = e;
      configurationResult = e.partialProjectConfigurationsResult;
    } else {
      throw e;
    }
  }
  const { projects, externalNodes, sourceMaps, projectRootMap } =
    configurationResult;
  performance.mark('retrieve-project-configurations:end');

  performance.mark('retrieve-workspace-files:start');
  const { allWorkspaceFiles, fileMap, rustReferences } =
    await retrieveWorkspaceFiles(workspaceRoot, projectRootMap);
  performance.mark('retrieve-workspace-files:end');

  const cacheEnabled = process.env.NX_CACHE_PROJECT_GRAPH !== 'false';
  performance.mark('build-project-graph-using-project-file-map:start');
  let projectGraphError: AggregateProjectGraphError;
  let projectGraphResult: Awaited<
    ReturnType<typeof buildProjectGraphUsingProjectFileMap>
  >;
  try {
    projectGraphResult = await buildProjectGraphUsingProjectFileMap(
      projects,
      externalNodes,
      fileMap,
      allWorkspaceFiles,
      rustReferences,
      cacheEnabled ? readFileMapCache() : null,
      plugins,
      sourceMaps
    );
  } catch (e) {
    if (isAggregateProjectGraphError(e)) {
      projectGraphResult = {
        projectGraph: e.partialProjectGraph,
        projectFileMapCache: null,
      };
      projectGraphError = e;
    } else {
      throw e;
    }
  }

  const { projectGraph, projectFileMapCache } = projectGraphResult;
  performance.mark('build-project-graph-using-project-file-map:end');

  delete global.NX_GRAPH_CREATION;

  const errors = [
    ...(projectConfigurationsError?.errors ?? []),
    ...(projectGraphError?.errors ?? []),
  ];

  if (errors.length > 0) {
    throw new ProjectGraphError(errors, projectGraph, sourceMaps);
  } else {
    if (cacheEnabled) {
      writeCache(projectFileMapCache, projectGraph, sourceMaps);
    }
    return { projectGraph, sourceMaps };
  }
}

export function handleProjectGraphError(opts: { exitOnError: boolean }, e) {
  if (opts.exitOnError) {
    const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';
    if (e instanceof ProjectGraphError) {
      let title = e.message;
      if (isVerbose) {
        title += ' See errors below.';
      }

      const bodyLines = isVerbose
        ? [e.stack]
        : ['Pass --verbose to see the stacktraces.'];

      output.error({
        title,
        bodyLines: bodyLines,
      });
    } else {
      const lines = e.message.split('\n');
      output.error({
        title: lines[0],
        bodyLines: lines.slice(1),
      });
      if (isVerbose) {
        console.error(e);
      }
    }
    process.exit(1);
  } else {
    throw e;
  }
}

async function readCachedGraphAndHydrateFileMap() {
  const graph = readCachedProjectGraph();
  const projectRootMap = Object.fromEntries(
    Object.entries(graph.nodes).map(([project, { data }]) => [
      data.root,
      project,
    ])
  );
  const { allWorkspaceFiles, fileMap, rustReferences } =
    await retrieveWorkspaceFiles(workspaceRoot, projectRootMap);
  hydrateFileMap(fileMap, allWorkspaceFiles, rustReferences);
  return graph;
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
 * * `useDaemonProcess` is set to false in the options of the tasks runner inside `nx.json`
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
  if (process.env.NX_FORCE_REUSE_CACHED_GRAPH === 'true') {
    try {
      // If no cached graph is found, we will fall through to the normal flow
      return readCachedGraphAndHydrateFileMap();
    } catch (e) {
      logger.verbose('Unable to use cached project graph', e);
    }
  }

  const projectGraphAndSourceMaps = await createProjectGraphAndSourceMapsAsync(
    opts
  );
  return projectGraphAndSourceMaps.projectGraph;
}

export async function createProjectGraphAndSourceMapsAsync(
  opts: { exitOnError: boolean; resetDaemonClient?: boolean } = {
    exitOnError: false,
    resetDaemonClient: false,
  }
) {
  performance.mark('create-project-graph-async:start');

  if (!daemonClient.enabled()) {
    const lock = new FileLock(join(workspaceDataDirectory, 'project-graph'));
    if (lock.locked) {
      logger.verbose(
        'Waiting for graph construction in another process to complete'
      );
      await lock.wait();
      const sourceMaps = readSourceMapsCache();
      if (!sourceMaps) {
        throw new Error(
          'The project graph was computed in another process, but the source maps are missing.'
        );
      }
      return {
        projectGraph: await readCachedGraphAndHydrateFileMap(),
        sourceMaps,
      };
    }
    lock.lock();
    try {
      const res = await buildProjectGraphAndSourceMapsWithoutDaemon();
      performance.measure(
        'create-project-graph-async >> retrieve-project-configurations',
        'retrieve-project-configurations:start',
        'retrieve-project-configurations:end'
      );
      performance.measure(
        'create-project-graph-async >> retrieve-workspace-files',
        'retrieve-workspace-files:start',
        'retrieve-workspace-files:end'
      );
      performance.measure(
        'create-project-graph-async >> build-project-graph-using-project-file-map',
        'build-project-graph-using-project-file-map:start',
        'build-project-graph-using-project-file-map:end'
      );
      performance.mark('create-project-graph-async:end');
      performance.measure(
        'create-project-graph-async',
        'create-project-graph-async:start',
        'create-project-graph-async:end'
      );
      lock.unlock();
      return res;
    } catch (e) {
      handleProjectGraphError(opts, e);
    }
  } else {
    try {
      const projectGraphAndSourceMaps =
        await daemonClient.getProjectGraphAndSourceMaps();
      performance.mark('create-project-graph-async:end');
      performance.measure(
        'create-project-graph-async',
        'create-project-graph-async:start',
        'create-project-graph-async:end'
      );
      return projectGraphAndSourceMaps;
    } catch (e) {
      if (e.message && e.message.indexOf('inotify_add_watch') > -1) {
        // common errors with the daemon due to OS settings (cannot watch all the files available)
        output.note({
          title: `Unable to start Nx Daemon due to the limited amount of inotify watches, continuing without the daemon.`,
          bodyLines: [
            'For more information read: https://askubuntu.com/questions/1088272/inotify-add-watch-failed-no-space-left-on-device',
            'Nx Daemon is going to be disabled until you run "nx reset".',
          ],
        });
        markDaemonAsDisabled();
        return buildProjectGraphAndSourceMapsWithoutDaemon();
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
        return buildProjectGraphAndSourceMapsWithoutDaemon();
      }

      handleProjectGraphError(opts, e);
    } finally {
      if (opts.resetDaemonClient) {
        daemonClient.reset();
      }
    }
  }
}
