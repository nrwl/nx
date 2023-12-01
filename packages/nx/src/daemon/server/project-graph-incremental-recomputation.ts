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
} from '../../project-graph/nx-deps-cache';
import {
  RetrievedGraphNodes,
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

interface SerializedProjectGraph {
  error: Error | null;
  projectGraph: ProjectGraph | null;
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
let storedWorkspaceConfigHash: string | undefined;
let waitPeriod = 100;
let scheduledTimeoutId;
let knownExternalNodes: Record<string, ProjectGraphExternalNode> = {};

export async function getCachedSerializedProjectGraphPromise(): Promise<SerializedProjectGraph> {
  try {
    // recomputing it now on demand. we can ignore the scheduled timeout
    if (scheduledTimeoutId) {
      clearTimeout(scheduledTimeoutId);
      scheduledTimeoutId = undefined;
    }

    // reset the wait time
    waitPeriod = 100;
    await resetInternalStateIfNxDepsMissing();
    if (collectedUpdatedFiles.size == 0 && collectedDeletedFiles.size == 0) {
      if (!cachedSerializedProjectGraphPromise) {
        cachedSerializedProjectGraphPromise =
          processFilesAndCreateAndSerializeProjectGraph();
      }
    } else {
      cachedSerializedProjectGraphPromise =
        processFilesAndCreateAndSerializeProjectGraph();
    }
    return await cachedSerializedProjectGraphPromise;
  } catch (e) {
    return {
      error: e,
      serializedProjectGraph: null,
      serializedSourceMaps: null,
      projectGraph: null,
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
        processFilesAndCreateAndSerializeProjectGraph();
      await cachedSerializedProjectGraphPromise;

      if (createdFiles.length > 0) {
        notifyFileWatcherSockets(createdFiles, null, null);
      }
    }, waitPeriod);
  }
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
  { projects, externalNodes, projectRootMap }: RetrievedGraphNodes,
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

async function processFilesAndCreateAndSerializeProjectGraph(): Promise<SerializedProjectGraph> {
  try {
    performance.mark('hash-watched-changes-start');
    const updatedFiles = [...collectedUpdatedFiles.values()];
    const deletedFiles = [...collectedDeletedFiles.values()];
    let updatedFileHashes = updateFilesInContext(updatedFiles, deletedFiles);
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
    const graphNodes = await retrieveProjectConfigurations(
      workspaceRoot,
      nxJson
    );
    await processCollectedUpdatedAndDeletedFiles(
      graphNodes,
      updatedFileHashes,
      deletedFiles
    );
    return createAndSerializeProjectGraph(graphNodes);
  } catch (err) {
    return Promise.resolve({
      error: err,
      projectGraph: null,
      fileMap: null,
      rustReferences: null,
      allWorkspaceFiles: null,
      serializedProjectGraph: null,
      serializedSourceMaps: null,
    });
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
}: RetrievedGraphNodes): Promise<SerializedProjectGraph> {
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
        true
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
