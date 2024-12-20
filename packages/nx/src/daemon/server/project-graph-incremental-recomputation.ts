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
import { buildProjectGraphUsingProjectFileMap as buildProjectGraphUsingFileMap } from '../../project-graph/build-project-graph';
import { updateFileMap } from '../../project-graph/file-map-utils';
import {
  FileMapCache,
  nxProjectGraph,
  readFileMapCache,
  writeCache,
} from '../../project-graph/nx-deps-cache';
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
import { notifyFileWatcherSockets } from './file-watching/file-watcher-sockets';
import { serverLogger } from './logger';
import { NxWorkspaceFilesExternals } from '../../native';
import { ConfigurationResult } from '../../project-graph/utils/project-configuration-utils';
import { LoadedNxPlugin } from '../../project-graph/plugins/internal-api';
import {
  DaemonProjectGraphError,
  ProjectConfigurationsError,
  isAggregateProjectGraphError,
} from '../../project-graph/error-types';
import { getPlugins } from '../../project-graph/plugins/get-plugins';

interface SerializedProjectGraph {
  error: Error | null;
  projectGraph: ProjectGraph | null;
  projectFileMapCache: FileMapCache | null;
  fileMap: FileMap | null;
  allWorkspaceFiles: FileData[] | null;
  serializedProjectGraph: string | null;
  serializedSourceMaps: string | null;
  rustReferences: NxWorkspaceFilesExternals | null;
}

let cachedSerializedProjectGraphPromise: Promise<SerializedProjectGraph>;
export let fileMapWithFiles:
  | {
      fileMap: FileMap;
      allWorkspaceFiles: FileData[];
      rustReferences: NxWorkspaceFilesExternals;
    }
  | undefined;
export let currentProjectFileMapCache: FileMapCache | undefined;
export let currentProjectGraph: ProjectGraph | undefined;

const collectedUpdatedFiles = new Set<string>();
const collectedDeletedFiles = new Set<string>();
const projectGraphRecomputationListeners = new Set<
  (projectGraph: ProjectGraph) => void
>();
let storedWorkspaceConfigHash: string | undefined;
let waitPeriod = 100;
let scheduledTimeoutId;
let knownExternalNodes: Record<string, ProjectGraphExternalNode> = {};

export async function getCachedSerializedProjectGraphPromise(): Promise<SerializedProjectGraph> {
  try {
    let wasScheduled = false;
    // recomputing it now on demand. we can ignore the scheduled timeout
    if (scheduledTimeoutId) {
      wasScheduled = true;
      clearTimeout(scheduledTimeoutId);
      scheduledTimeoutId = undefined;
    }

    // reset the wait time
    waitPeriod = 100;
    await resetInternalStateIfNxDepsMissing();
    const plugins = await getPlugins();
    if (collectedUpdatedFiles.size == 0 && collectedDeletedFiles.size == 0) {
      if (!cachedSerializedProjectGraphPromise) {
        cachedSerializedProjectGraphPromise =
          processFilesAndCreateAndSerializeProjectGraph(plugins);
      }
    } else {
      cachedSerializedProjectGraphPromise =
        processFilesAndCreateAndSerializeProjectGraph(plugins);
    }
    const result = await cachedSerializedProjectGraphPromise;

    if (wasScheduled) {
      notifyProjectGraphRecomputationListeners(result.projectGraph);
    }

    return result;
  } catch (e) {
    return {
      error: e,
      serializedProjectGraph: null,
      serializedSourceMaps: null,
      projectGraph: null,
      projectFileMapCache: null,
      fileMap: null,
      allWorkspaceFiles: null,
      rustReferences: null,
    };
  }
}

export function addUpdatedAndDeletedFiles(
  createdFiles: string[],
  updatedFiles: string[],
  deletedFiles: string[]
) {
  for (let f of [...createdFiles, ...updatedFiles]) {
    collectedDeletedFiles.delete(f);
    collectedUpdatedFiles.add(f);
  }

  for (let f of deletedFiles) {
    collectedUpdatedFiles.delete(f);
    collectedDeletedFiles.add(f);
  }

  if (updatedFiles.length > 0 || deletedFiles.length > 0) {
    notifyFileWatcherSockets(null, updatedFiles, deletedFiles);
  }

  if (createdFiles.length > 0) {
    waitPeriod = 100; // reset it to process the graph faster
  }

  if (!scheduledTimeoutId) {
    scheduledTimeoutId = setTimeout(async () => {
      scheduledTimeoutId = undefined;
      if (waitPeriod < 4000) {
        waitPeriod = waitPeriod * 2;
      }

      cachedSerializedProjectGraphPromise =
        processFilesAndCreateAndSerializeProjectGraph(await getPlugins());
      const { projectGraph } = await cachedSerializedProjectGraphPromise;

      if (createdFiles.length > 0) {
        notifyFileWatcherSockets(createdFiles, null, null);
      }

      notifyProjectGraphRecomputationListeners(projectGraph);
    }, waitPeriod);
  }
}

export function registerProjectGraphRecomputationListener(
  listener: (projectGraph: ProjectGraph) => void
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

    collectedUpdatedFiles.clear();
    collectedDeletedFiles.clear();
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

async function processFilesAndCreateAndSerializeProjectGraph(
  plugins: LoadedNxPlugin[]
): Promise<SerializedProjectGraph> {
  try {
    performance.mark('hash-watched-changes-start');
    const updatedFiles = [...collectedUpdatedFiles.values()];
    const deletedFiles = [...collectedDeletedFiles.values()];
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
    serverLogger.requestLog([...updatedFiles.values()]);
    serverLogger.requestLog([...deletedFiles]);
    const nxJson = readNxJson(workspaceRoot);
    global.NX_GRAPH_CREATION = true;

    let projectConfigurationsResult: ConfigurationResult;
    let projectConfigurationsError;

    try {
      projectConfigurationsResult = await retrieveProjectConfigurations(
        plugins,
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
    await processCollectedUpdatedAndDeletedFiles(
      projectConfigurationsResult,
      updatedFileHashes,
      deletedFiles
    );
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
          fileMap: null,
          rustReferences: null,
          allWorkspaceFiles: null,
          serializedProjectGraph: null,
          serializedSourceMaps: null,
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
        fileMap: null,
        rustReferences: null,
        allWorkspaceFiles: null,
        serializedProjectGraph: null,
        serializedSourceMaps: null,
      };
    } else {
      writeCache(
        g.projectFileMapCache,
        g.projectGraph,
        projectConfigurationsResult.sourceMaps
      );
      return g;
    }
  } catch (err) {
    return {
      error: err,
      projectGraph: null,
      projectFileMapCache: null,
      fileMap: null,
      rustReferences: null,
      allWorkspaceFiles: null,
      serializedProjectGraph: null,
      serializedSourceMaps: null,
    };
  }
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
    const allWorkspaceFiles = copyFileData(fileMapWithFiles.allWorkspaceFiles);
    const rustReferences = fileMapWithFiles.rustReferences;
    const { projectGraph, projectFileMapCache } =
      await buildProjectGraphUsingFileMap(
        projects,
        knownExternalNodes,
        fileMap,
        allWorkspaceFiles,
        rustReferences,
        currentProjectFileMapCache || readFileMapCache(),
        await getPlugins(),
        sourceMaps
      );

    currentProjectFileMapCache = projectFileMapCache;
    currentProjectGraph = projectGraph;

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
      fileMap,
      allWorkspaceFiles,
      serializedProjectGraph,
      serializedSourceMaps,
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
      fileMap: null,
      allWorkspaceFiles: null,
      serializedProjectGraph: null,
      serializedSourceMaps: null,
      rustReferences: null,
    };
  }
}

async function resetInternalState() {
  cachedSerializedProjectGraphPromise = undefined;
  fileMapWithFiles = undefined;
  currentProjectFileMapCache = undefined;
  currentProjectGraph = undefined;
  collectedUpdatedFiles.clear();
  collectedDeletedFiles.clear();
  resetWorkspaceContext();
  waitPeriod = 100;
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

function notifyProjectGraphRecomputationListeners(projectGraph: ProjectGraph) {
  for (const listener of projectGraphRecomputationListeners) {
    listener(projectGraph);
  }
}
