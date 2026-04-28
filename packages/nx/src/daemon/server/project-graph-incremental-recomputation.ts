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
import { flushPendingWorkspaceChanges } from './watcher';
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
let knownExternalNodes: Record<string, ProjectGraphExternalNode> = {};
let fileChangeCounter = 0;
let recomputationGeneration = 0;

// True after the first successful persistProjectGraphToDisk call. Until
// that happens, "project-graph.json missing on disk" is the expected
// state (we just haven't written it yet) and must not trigger a reset.
let cacheHasBeenPersisted = false;

/**
 * Start a fresh project graph computation, in parallel with any in-flight
 * one. The new promise becomes `cachedSerializedProjectGraphPromise`; any
 * older compute will detect itself as stale at its next `isStale()` check
 * and chain to the cached pointer, so consumers awaiting the cached pointer
 * always end up on the latest compute.
 *
 * Notify + persist fire only when this IIFE is still the latest — older
 * IIFEs that chained their result through us have already had their side
 * effects fired by the IIFE that actually produced the result.
 */
function kickOffRecompute() {
  let myPromise: Promise<SerializedProjectGraph>;
  myPromise = (async () => {
    const plugins = await getPluginsSeparated();
    const result = await processFilesAndCreateAndSerializeProjectGraph(plugins);
    if (
      cachedSerializedProjectGraphPromise === myPromise &&
      result.projectGraph
    ) {
      notifyProjectGraphRecomputationListeners(
        result.projectGraph,
        result.sourceMaps,
        result.error
      );
      persistProjectGraphToDisk(result);
    }
    return result;
  })();
  cachedSerializedProjectGraphPromise = myPromise;
}

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
    // Drain anything the native watcher has buffered before deciding
    // whether the cached graph is fresh. Without this, a file change
    // that already arrived in the watcher's accumulator but hasn't
    // flushed past IDLE_WINDOW yet would be invisible to the staleness
    // check below — the daemon would return a stale graph.
    await flushPendingWorkspaceChanges();

    await resetInternalStateIfNxDepsMissing();

    // If no compute exists or events are still in collected*, kick one off.
    // Otherwise reuse whatever is already in flight or cached.
    const needsRecompute =
      !cachedSerializedProjectGraphPromise ||
      collectedUpdatedFiles.size > 0 ||
      collectedDeletedFiles.size > 0;
    if (needsRecompute) {
      serverLogger.log(
        cachedSerializedProjectGraphPromise
          ? `Recomputing project graph because of ${collectedUpdatedFiles.size} updated and ${collectedDeletedFiles.size} deleted files.`
          : 'No in-memory cached project graph found. Recomputing it...'
      );
      kickOffRecompute();
    } else {
      serverLogger.log(
        'Reusing in-memory cached project graph because no files changed.'
      );
    }

    // A stale compute returns cachedSerializedProjectGraphPromise (the
    // newer compute that replaced it); promise unwrapping flattens the
    // chain so we always end up with the latest real result.
    const result = await cachedSerializedProjectGraphPromise;

    // Even when the loop didn't recompute, write the cache if it's stale on
    // disk relative to the in-memory result. This protects against
    // non-daemon processes overwriting the daemon's valid graph with a
    // stale/errored one.
    if (
      !needsRecompute &&
      result.projectGraph &&
      result.projectFileMapCache &&
      result.sourceMaps
    ) {
      writeCacheIfStale(
        result.projectFileMapCache,
        result.projectGraph,
        result.sourceMaps,
        extractErrors(result.error)
      );
    }

    const errors = extractErrors(result.error);

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
    // Bump generation synchronously so any in-flight compute fails its
    // next isStale() check and chains to the newer one. kickOffRecompute
    // would also bump on first resume, but only after its first await —
    // a window during which the old compute could falsely pass.
    ++recomputationGeneration;
    kickOffRecompute();
  } else {
    // First call (initial startup) — no events but we still need a graph.
    if (!cachedSerializedProjectGraphPromise) {
      kickOffRecompute();
    }
  }
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

type FileMapUpdate = {
  fileMap: NonNullable<typeof fileMapWithFiles>;
  configHash: string;
  knownExternalNodes?: Record<string, ProjectGraphExternalNode>;
};

async function processCollectedUpdatedAndDeletedFiles(
  { projects, externalNodes, projectRootMap }: ConfigurationResult,
  updatedFileHashes: Record<string, string>,
  deletedFiles: string[]
): Promise<FileMapUpdate> {
  try {
    const configHash = computeWorkspaceConfigHash(projects);

    // Config changed → can't incrementally update; refetch the file map
    // from disk. Returning instead of mutating module state lets the caller
    // gate the commit on its staleness check, so a slower stale compute
    // can't clobber a faster newer one's already-committed state.
    if (configHash !== storedWorkspaceConfigHash) {
      const fresh = await retrieveWorkspaceFiles(workspaceRoot, projectRootMap);
      return { fileMap: fresh, configHash, knownExternalNodes: externalNodes };
    }

    // Config unchanged → patch the existing file map in place.
    if (fileMapWithFiles) {
      return {
        fileMap: updateFileMap(
          projects,
          fileMapWithFiles.rustReferences,
          updatedFileHashes,
          deletedFiles
        ),
        configHash,
      };
    }

    // No prior map (first compute on this daemon).
    const fresh = await retrieveWorkspaceFiles(workspaceRoot, projectRootMap);
    return { fileMap: fresh, configHash };
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

  // A newer kickOffRecompute has already replaced
  // cachedSerializedProjectGraphPromise. Returning it lets the async
  // unwrap chain our caller onto the newer compute's result; pass
  // notifyAbort=true when the graph-phase counters still need balancing.
  const chainToLatest = (notifyAbort: boolean) => {
    if (myGeneration === recomputationGeneration) return null;
    if (notifyAbort) notifyPluginsGraphAborted(plugins);
    // Defensive: if the cache was cleared (e.g. resetInternalState ran)
    // there is nothing to chain to. Returning undefined lets `if (stale)
    // return stale` fall through and the compute commits stale data.
    // Kick off a successor so we always have a real promise to chain to.
    if (!cachedSerializedProjectGraphPromise) {
      kickOffRecompute();
    }
    return cachedSerializedProjectGraphPromise;
  };

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

    const stalePostCreateNodes = chainToLatest(true);
    if (stalePostCreateNodes) return stalePostCreateNodes;

    const fileMapUpdate = await processCollectedUpdatedAndDeletedFiles(
      projectConfigurationsResult,
      updatedFileHashes,
      deletedFiles
    );

    const stalePreCreateDependencies = chainToLatest(true);
    if (stalePreCreateDependencies) return stalePreCreateDependencies;

    // Latest writer commits to module state. Stale computes returned via
    // chainToLatest above without touching `fileMapWithFiles`, so they
    // can't clobber a newer compute's write.
    fileMapWithFiles = fileMapUpdate.fileMap;
    storedWorkspaceConfigHash = fileMapUpdate.configHash;
    if (fileMapUpdate.knownExternalNodes) {
      knownExternalNodes = fileMapUpdate.knownExternalNodes;
    }

    // Drain only after committing — a stale compute that returns at the
    // staleness check above must leave its snapshot in `collected*` so the
    // newer compute still sees those files. Removing them earlier would
    // make the next compute snapshot empty and the file changes vanish
    // from the daemon's view (project graph misses recently added files).
    // Match version-stamps so a file modified mid-flight (higher version)
    // stays in the queue for reprocessing.
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

    const g = await createAndSerializeProjectGraph(projectConfigurationsResult);

    delete global.NX_GRAPH_CREATION;

    // createDependencies/createMetadata already ran via wrapped hooks, so
    // graph-phase counters are balanced — no notifyAbort needed.
    const stalePostBuild = chainToLatest(false);
    if (stalePostBuild) return stalePostBuild;

    const errors = [...(projectConfigurationsError?.errors ?? [])];
    const aggregate =
      g.error && isAggregateProjectGraphError(g.error) && g.error.errors?.length
        ? g.error
        : null;
    if (g.error && !aggregate) return errorResult(g.error);
    if (aggregate) errors.push(...aggregate.errors);
    if (errors.length === 0) return g;
    return errorResult(
      new DaemonProjectGraphError(
        errors,
        g.projectGraph,
        projectConfigurationsResult.sourceMaps
      )
    );
  } catch (err) {
    return errorResult(err);
  }
}

function errorResult(
  error: SerializedProjectGraph['error']
): SerializedProjectGraph {
  return {
    error,
    projectGraph: null,
    projectFileMapCache: null,
    rustReferences: null,
    serializedProjectGraph: null,
    serializedSourceMaps: null,
    sourceMaps: null,
  };
}

function extractErrors(error: SerializedProjectGraph['error']) {
  if (!error) return [];
  return error instanceof DaemonProjectGraphError ? error.errors : [error];
}

function persistProjectGraphToDisk(result: SerializedProjectGraph) {
  if (
    !result.projectGraph ||
    !result.projectFileMapCache ||
    !result.sourceMaps
  ) {
    return;
  }
  writeCache(
    result.projectFileMapCache,
    result.projectGraph,
    result.sourceMaps,
    extractErrors(result.error)
  );
  cacheHasBeenPersisted = true;
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
  cacheHasBeenPersisted = false;
  resetWorkspaceContext();
}

async function resetInternalStateIfNxDepsMissing() {
  // Only meaningful AFTER we've persisted the cache at least once.
  // Before then, "file missing" is the expected state — an in-flight
  // first compute hasn't written yet, and resetting would tear down its
  // promise mid-await and force a redundant recompute.
  if (!cacheHasBeenPersisted) {
    return;
  }
  try {
    if (!fileExists(nxProjectGraph) && cachedSerializedProjectGraphPromise) {
      await resetInternalState();
    }
  } catch {
    // A transient stat error shouldn't nuke state — the next request
    // will retry.
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
