import { Socket } from 'net';
import { performance } from 'perf_hooks';
import { readNxJson } from '../../config/nx-json';
import {
  FileData,
  FileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { hashArray } from '../../hasher/file-hasher';
import { NxWorkspaceFilesExternals } from '../../native';
import { buildProjectGraphUsingProjectFileMap as buildProjectGraphUsingFileMap } from '../../project-graph/build-project-graph';
import {
  DaemonProjectGraphError,
  ProjectConfigurationsError,
  isAggregateProjectGraphError,
} from '../../project-graph/error-types';
import { updateFileMap } from '../../project-graph/file-map-utils';
import {
  FileMapCache,
  nxProjectGraph,
  readFileMapCache,
  writeCache,
  writeCacheIfStale,
} from '../../project-graph/nx-deps-cache';
import {
  getPlugins,
  getPluginsSeparated,
  SeparatedPlugins,
} from '../../project-graph/plugins/get-plugins';
import type { LoadedNxPlugin } from '../../project-graph/plugins/loaded-nx-plugin';
import { ConfigurationResult } from '../../project-graph/utils/project-configuration-utils';
import { ConfigurationSourceMaps } from '../../project-graph/utils/project-configuration/source-maps';
import {
  retrieveProjectConfigurations,
  retrieveWorkspaceFiles,
} from '../../project-graph/utils/retrieve-workspace-files';
import { fileExists } from '../../utils/fileutils';
import {
  resetWorkspaceContext,
  updateFilesInContext,
} from '../../utils/workspace-context';
import { workspaceRoot } from '../../utils/workspace-root';
import { ProgressTopics } from '../../utils/progress-topics';
import {
  subscribeClientToTopic,
  unsubscribeClientFromTopic,
} from './client-socket-context';
import { notifyFileChangeListeners } from './file-watching/file-change-events';
import { notifyFileWatcherSockets } from './file-watching/file-watcher-sockets';
import { notifyProjectGraphListenerSockets } from './project-graph-listener-sockets';
import { serverLogger } from '../logger';

interface SerializedProjectGraph {
  error: Error | null;
  projectGraph: ProjectGraph | null;
  projectFileMapCache: FileMapCache | null;
  serializedProjectGraph: string | null;
  serializedSourceMaps: string | null;
  sourceMaps: ConfigurationSourceMaps | null;
  rustReferences: NxWorkspaceFilesExternals | null;
}

let cachedSerializedProjectGraphPromise: Promise<SerializedProjectGraph>;
export let fileMapWithFiles:
  | {
      fileMap: FileMap;
      rustReferences: NxWorkspaceFilesExternals;
    }
  | undefined;
export let currentProjectFileMapCache: FileMapCache | undefined;
export let currentProjectGraph: ProjectGraph | undefined;
export let currentSourceMaps: ConfigurationSourceMaps | undefined;

// Maps file path to a version counter that increments on each modification.
// This lets us detect mid-flight re-modifications when clearing processed files.
const collectedUpdatedFiles = new Map<string, number>();
const collectedDeletedFiles = new Map<string, number>();

const projectGraphRecomputationListeners = new Set<
  (
    projectGraph: ProjectGraph,
    sourceMaps: ConfigurationSourceMaps,
    error: Error | null
  ) => void
>();
let storedWorkspaceConfigHash: string | undefined;
// Set while an auto-triggered graph recomputation is in flight. Rapid
// subsequent `scheduleProjectGraphRecomputation` calls don't start new runs;
// the running loop picks up accumulated files on its next iteration.
let autoRecomputePromise: Promise<void> | undefined;
let knownExternalNodes: Record<string, ProjectGraphExternalNode> = {};
let fileChangeCounter = 0;
let recomputationGeneration = 0;

export async function getCachedSerializedProjectGraphPromise(
  socket?: Socket
): Promise<SerializedProjectGraph> {
  // Subscribe the requesting client to the graph-construction topic
  // for the duration of the await, so in-flight progress/log messages
  // — including those produced by a recomputation that was already
  // started before this caller arrived — are broadcast to them.
  if (socket) {
    subscribeClientToTopic(socket, ProgressTopics.GraphConstruction);
  }
  try {
    // If an auto-recompute is in flight, let it finish. It already writes
    // `cachedSerializedProjectGraphPromise` and notifies listeners, so after
    // awaiting we just fall through to serve its result.
    if (autoRecomputePromise) {
      await autoRecomputePromise;
    }

    await resetInternalStateIfNxDepsMissing();
    const separatedPlugins = await getPluginsSeparated();
    const previousPromise = cachedSerializedProjectGraphPromise;
    if (collectedUpdatedFiles.size == 0 && collectedDeletedFiles.size == 0) {
      if (!cachedSerializedProjectGraphPromise) {
        cachedSerializedProjectGraphPromise =
          processFilesAndCreateAndSerializeProjectGraph(separatedPlugins);
        serverLogger.log(
          'No files changed, but no in-memory cached project graph found. Recomputing it...'
        );
      } else {
        serverLogger.log(
          'Reusing in-memory cached project graph because no files changed.'
        );
      }
    } else {
      serverLogger.log(
        `Recomputing project graph because of ${collectedUpdatedFiles.size} updated and ${collectedDeletedFiles.size} deleted files.`
      );
      cachedSerializedProjectGraphPromise =
        processFilesAndCreateAndSerializeProjectGraph(separatedPlugins);
    }
    const graphWasRecomputed =
      cachedSerializedProjectGraphPromise !== previousPromise;
    const result = await cachedSerializedProjectGraphPromise;

    const errors = extractErrors(result.error);

    // Keep disk in sync with our in-memory cache so non-daemon processes
    // (and the daemon on next start) don't read stale or errored data.
    persistProjectGraph(result, graphWasRecomputed);

    if (errors?.length) {
      cachedSerializedProjectGraphPromise = null;
    }

    return result;
  } catch (e) {
    // We return the project graph, but we don't want to persist the cache to
    // serve the same state, as it could cause issues if the error is caused by something
    // transient
    cachedSerializedProjectGraphPromise = null;
    return {
      error: e,
      serializedProjectGraph: null,
      serializedSourceMaps: null,
      sourceMaps: null,
      projectGraph: null,
      projectFileMapCache: null,
      rustReferences: null,
    };
  } finally {
    if (socket) {
      unsubscribeClientFromTopic(socket, ProgressTopics.GraphConstruction);
    }
  }
}

export function scheduleProjectGraphRecomputation(
  createdFiles: string[],
  updatedFiles: string[],
  deletedFiles: string[]
) {
  ++fileChangeCounter;
  for (let f of [...createdFiles, ...updatedFiles]) {
    collectedDeletedFiles.delete(f);
    collectedUpdatedFiles.set(f, fileChangeCounter);
  }

  for (let f of deletedFiles) {
    collectedUpdatedFiles.delete(f);
    collectedDeletedFiles.set(f, fileChangeCounter);
  }

  // The native watcher already coalesces a burst of events into one batch,
  // so socket + listener notifications dispatch immediately.
  if (
    createdFiles.length > 0 ||
    updatedFiles.length > 0 ||
    deletedFiles.length > 0
  ) {
    notifyFileChangeListeners({ createdFiles, updatedFiles, deletedFiles });
    notifyFileWatcherSockets(createdFiles, updatedFiles, deletedFiles);
  }

  startAutoRecompute();
}

/**
 * Start the auto-recompute loop. If one is already running, no-op — the
 * running loop's next iteration will pick up newly-accumulated files via
 * the collected* maps.
 *
 * Listeners are notified once per completed iteration. The loop runs at
 * least once unconditionally so initial startup (called with empty file
 * lists) still produces an initial graph.
 */
function startAutoRecompute() {
  if (autoRecomputePromise) return;
  autoRecomputePromise = (async () => {
    try {
      do {
        cachedSerializedProjectGraphPromise =
          processFilesAndCreateAndSerializeProjectGraph(
            await getPluginsSeparated()
          );
        const result = await cachedSerializedProjectGraphPromise;
        notifyProjectGraphRecomputationListeners(
          result.projectGraph,
          result.sourceMaps,
          result.error
        );

        // Subprocesses that read the cache directly (e.g. eslint rules
        // calling readCachedProjectGraph) bypass the daemon socket, so
        // they only see updates that hit disk.
        persistProjectGraph(result, true);
      } while (
        collectedUpdatedFiles.size > 0 ||
        collectedDeletedFiles.size > 0
      );
    } finally {
      autoRecomputePromise = undefined;
    }
  })();
}

export function registerProjectGraphRecomputationListener(
  listener: (
    projectGraph: ProjectGraph,
    sourceMaps: ConfigurationSourceMaps,
    error: Error | null
  ) => void
) {
  projectGraphRecomputationListeners.add(listener);
}

function computeWorkspaceConfigHash(
  projectsConfigurations: Record<string, ProjectConfiguration>
) {
  const projectConfigurationStrings = Object.entries(projectsConfigurations)
    .sort(([projectNameA], [projectNameB]) =>
      projectNameA.localeCompare(projectNameB)
    )
    .map(
      ([projectName, projectConfig]) =>
        `${projectName}:${JSON.stringify(projectConfig)}`
    );
  return hashArray(projectConfigurationStrings);
}

async function processCollectedUpdatedAndDeletedFiles(
  { projects, externalNodes, projectRootMap }: ConfigurationResult,
  updatedFileHashes: Record<string, string>,
  deletedFiles: string[]
) {
  try {
    const workspaceConfigHash = computeWorkspaceConfigHash(projects);

    // when workspace config changes we cannot incrementally update project file map
    if (workspaceConfigHash !== storedWorkspaceConfigHash) {
      storedWorkspaceConfigHash = workspaceConfigHash;

      ({ ...fileMapWithFiles } = await retrieveWorkspaceFiles(
        workspaceRoot,
        projectRootMap
      ));

      knownExternalNodes = externalNodes;
    } else {
      if (fileMapWithFiles) {
        fileMapWithFiles = updateFileMap(
          projects,
          fileMapWithFiles.rustReferences,
          updatedFileHashes,
          deletedFiles
        );
      } else {
        fileMapWithFiles = await retrieveWorkspaceFiles(
          workspaceRoot,
          projectRootMap
        );
      }
    }
  } catch (e) {
    // this is expected
    // for instance, project.json can be incorrect or a file we are trying to has
    // has been deleted
    // we are resetting internal state to start from scratch next time a file changes
    // given the user the opportunity to fix the error
    // if Nx requests the project graph prior to the error being fixed,
    // the error will be propagated
    serverLogger.log(
      `Error detected when recomputing project file map: ${e.message}`
    );
    resetInternalState();
    throw e;
  }
}

export function invalidateGraphCache() {
  // Clear the cached promise so the next request triggers a fresh computation.
  // We intentionally do NOT call getCachedSerializedProjectGraphPromise() here
  // because assigning its return Promise to the module-level variable causes a
  // deadlock: the async function resumes, sees the variable is non-null (pointing
  // at its own Promise), takes the "reuse" branch, and awaits itself forever.
  cachedSerializedProjectGraphPromise = null;
}

async function processFilesAndCreateAndSerializeProjectGraph(
  separatedPlugins: SeparatedPlugins
): Promise<SerializedProjectGraph> {
  const plugins = [
    ...separatedPlugins.specifiedPlugins,
    ...separatedPlugins.defaultPlugins,
  ];
  const myGeneration = ++recomputationGeneration;

  // Helper to check if this recomputation is stale (a newer one has started)
  const isStale = () => myGeneration !== recomputationGeneration;

  try {
    performance.mark('hash-watched-changes-start');
    const updatedFilesSnapshot = new Map(collectedUpdatedFiles);
    const deletedFilesSnapshot = new Map(collectedDeletedFiles);
    const updatedFiles = [...updatedFilesSnapshot.keys()];
    const deletedFiles = [...deletedFilesSnapshot.keys()];
    let updatedFileHashes = updateFilesInContext(
      workspaceRoot,
      updatedFiles,
      deletedFiles
    );
    performance.mark('hash-watched-changes-end');
    performance.measure(
      'hash changed files from watcher',
      'hash-watched-changes-start',
      'hash-watched-changes-end'
    );
    serverLogger.requestLog(
      `Updated workspace context based on watched changes, recomputing project graph...`
    );
    serverLogger.requestLog(updatedFiles);
    serverLogger.requestLog(deletedFiles);
    const nxJson = readNxJson(workspaceRoot);
    global.NX_GRAPH_CREATION = true;

    let projectConfigurationsResult: ConfigurationResult;
    let projectConfigurationsError;

    try {
      projectConfigurationsResult = await retrieveProjectConfigurations(
        separatedPlugins,
        workspaceRoot,
        nxJson
      );
    } catch (e) {
      if (e instanceof ProjectConfigurationsError) {
        projectConfigurationsResult = e.partialProjectConfigurationsResult;
        projectConfigurationsError = e;
      } else {
        throw e;
      }
    }

    // Early exit if a newer recomputation has started - chain to the newer one
    if (isStale()) {
      notifyPluginsGraphAborted(plugins);
      return cachedSerializedProjectGraphPromise;
    }

    await processCollectedUpdatedAndDeletedFiles(
      projectConfigurationsResult,
      updatedFileHashes,
      deletedFiles
    );

    // Only remove files whose version matches the snapshot — if the version
    // is higher, the file was modified again mid-flight and needs reprocessing.
    for (const [f, version] of updatedFilesSnapshot) {
      if (collectedUpdatedFiles.get(f) === version) {
        collectedUpdatedFiles.delete(f);
      }
    }
    for (const [f, version] of deletedFilesSnapshot) {
      if (collectedDeletedFiles.get(f) === version) {
        collectedDeletedFiles.delete(f);
      }
    }

    // Early exit if a newer recomputation has started - chain to the newer one
    if (isStale()) {
      notifyPluginsGraphAborted(plugins);
      return cachedSerializedProjectGraphPromise;
    }

    const g = await createAndSerializeProjectGraph(projectConfigurationsResult);

    delete global.NX_GRAPH_CREATION;

    const errors = [...(projectConfigurationsError?.errors ?? [])];

    if (g.error) {
      if (isAggregateProjectGraphError(g.error) && g.error.errors?.length) {
        errors.push(...g.error.errors);
      } else {
        return {
          error: g.error,
          projectGraph: null,
          projectFileMapCache: null,
          rustReferences: null,
          serializedProjectGraph: null,
          serializedSourceMaps: null,
          sourceMaps: null,
        };
      }
    }
    if (errors.length > 0) {
      return {
        error: new DaemonProjectGraphError(
          errors,
          g.projectGraph,
          projectConfigurationsResult.sourceMaps
        ),
        projectGraph: null,
        projectFileMapCache: null,
        rustReferences: null,
        serializedProjectGraph: null,
        serializedSourceMaps: null,
        sourceMaps: null,
      };
    } else {
      return g;
    }
  } catch (err) {
    return {
      error: err,
      projectGraph: null,
      projectFileMapCache: null,
      rustReferences: null,
      serializedProjectGraph: null,
      serializedSourceMaps: null,
      sourceMaps: null,
    };
  }
}

function extractErrors(error: SerializedProjectGraph['error']) {
  if (!error) return [];
  return error instanceof DaemonProjectGraphError ? error.errors : [error];
}

function persistProjectGraph(
  result: SerializedProjectGraph,
  freshlyRecomputed: boolean
) {
  if (
    !result.projectGraph ||
    !result.projectFileMapCache ||
    !result.sourceMaps
  ) {
    return;
  }
  // Just-recomputed → always write so disk reflects new state. Serving
  // cached → use writeCacheIfStale to skip the write when disk hasn't
  // drifted since our last write.
  const writeFn = freshlyRecomputed ? writeCache : writeCacheIfStale;
  writeFn(
    result.projectFileMapCache,
    result.projectGraph,
    result.sourceMaps,
    extractErrors(result.error)
  );
}

function copyFileData<T extends FileData>(d: T[]) {
  return d.map((t) => ({ ...t }));
}

function copyFileMap(m: FileMap) {
  const c: FileMap = {
    nonProjectFiles: copyFileData(m.nonProjectFiles),
    projectFileMap: {},
  };
  for (let p of Object.keys(m.projectFileMap)) {
    c.projectFileMap[p] = copyFileData(m.projectFileMap[p]);
  }
  return c;
}

async function createAndSerializeProjectGraph({
  projects,
  sourceMaps,
}: ConfigurationResult): Promise<SerializedProjectGraph> {
  try {
    performance.mark('create-project-graph-start');
    const fileMap = copyFileMap(fileMapWithFiles.fileMap);
    const rustReferences = fileMapWithFiles.rustReferences;
    const { projectGraph, projectFileMapCache } =
      await buildProjectGraphUsingFileMap(
        projects,
        knownExternalNodes,
        fileMap,
        rustReferences,
        currentProjectFileMapCache || readFileMapCache(),
        await getPlugins(),
        sourceMaps
      );

    currentProjectFileMapCache = projectFileMapCache;
    currentProjectGraph = projectGraph;
    currentSourceMaps = sourceMaps;

    performance.mark('create-project-graph-end');
    performance.measure(
      'total execution time for createProjectGraph()',
      'create-project-graph-start',
      'create-project-graph-end'
    );

    performance.mark('json-stringify-start');
    const serializedProjectGraph = JSON.stringify(projectGraph);
    const serializedSourceMaps = JSON.stringify(sourceMaps);
    performance.mark('json-stringify-end');
    performance.measure(
      'serialize graph',
      'json-stringify-start',
      'json-stringify-end'
    );

    return {
      error: null,
      projectGraph,
      projectFileMapCache,
      serializedProjectGraph,
      serializedSourceMaps,
      sourceMaps,
      rustReferences,
    };
  } catch (e) {
    serverLogger.log(
      `Error detected when creating a project graph: ${e.message}`
    );
    return {
      error: e,
      projectGraph: null,
      projectFileMapCache: null,
      serializedProjectGraph: null,
      serializedSourceMaps: null,
      sourceMaps: null,
      rustReferences: null,
    };
  }
}

async function resetInternalState() {
  cachedSerializedProjectGraphPromise = undefined;
  fileMapWithFiles = undefined;
  currentProjectFileMapCache = undefined;
  currentProjectGraph = undefined;
  currentSourceMaps = undefined;
  collectedUpdatedFiles.clear();
  collectedDeletedFiles.clear();
  resetWorkspaceContext();
}

async function resetInternalStateIfNxDepsMissing() {
  try {
    if (!fileExists(nxProjectGraph) && cachedSerializedProjectGraphPromise) {
      await resetInternalState();
    }
  } catch (e) {
    await resetInternalState();
  }
}

function notifyPluginsGraphAborted(plugins: LoadedNxPlugin[]) {
  // At both abort sites, only createNodes has been called.
  // createDependencies and createMetadata are called later in
  // createAndSerializeProjectGraph, which hasn't run yet.
  for (const plugin of plugins) {
    plugin.notifyPhaseAborted?.('graph', 'createNodes');
  }
}

function notifyProjectGraphRecomputationListeners(
  projectGraph: ProjectGraph,
  sourceMaps: ConfigurationSourceMaps,
  error: Error | null
) {
  for (const listener of projectGraphRecomputationListeners) {
    listener(projectGraph, sourceMaps, error);
  }
  notifyProjectGraphListenerSockets(projectGraph, sourceMaps, error);
}
