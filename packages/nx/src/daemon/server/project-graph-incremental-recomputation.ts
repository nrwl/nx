import { performance } from 'perf_hooks';
import {
  FileData,
  FileMap,
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph';
import { buildProjectGraphUsingProjectFileMap as buildProjectGraphUsingFileMap } from '../../project-graph/build-project-graph';
import { updateFileMap } from '../../project-graph/file-map-utils';
import {
  nxProjectGraph,
  FileMapCache,
  readFileMapCache,
} from '../../project-graph/nx-deps-cache';
import { fileExists } from '../../utils/fileutils';
import { notifyFileWatcherSockets } from './file-watching/file-watcher-sockets';
import { serverLogger } from './logger';
import { workspaceRoot } from '../../utils/workspace-root';
import { execSync } from 'child_process';
import { hashArray } from '../../hasher/file-hasher';
import {
  retrieveWorkspaceFiles,
  retrieveProjectConfigurations,
} from '../../project-graph/utils/retrieve-workspace-files';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../../config/workspace-json-project-json';
import { readNxJson } from '../../config/nx-json';
import {
  resetWorkspaceContext,
  updateFilesInContext,
} from '../../utils/workspace-context';

let cachedSerializedProjectGraphPromise: Promise<{
  error: Error | null;
  projectGraph: ProjectGraph | null;
  fileMap: FileMap | null;
  allWorkspaceFiles: FileData[] | null;
  serializedProjectGraph: string | null;
}>;
export let fileMapWithFiles:
  | { fileMap: FileMap; allWorkspaceFiles: FileData[] }
  | undefined;
export let currentProjectFileMapCache: FileMapCache | undefined;
export let currentProjectGraph: ProjectGraph | undefined;

const collectedUpdatedFiles = new Set<string>();
const collectedDeletedFiles = new Set<string>();
let storedWorkspaceConfigHash: string | undefined;
let waitPeriod = 100;
let scheduledTimeoutId;
let knownExternalNodes: Record<string, ProjectGraphExternalNode> = {};

export async function getCachedSerializedProjectGraphPromise() {
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
      projectGraph: null,
      fileMap: null,
      allWorkspaceFiles: null,
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

async function processCollectedUpdatedAndDeletedFiles() {
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

    const nxJson = readNxJson(workspaceRoot);

    const { projectNodes } = await retrieveProjectConfigurations(
      workspaceRoot,
      nxJson
    );

    const workspaceConfigHash = computeWorkspaceConfigHash(projectNodes);
    serverLogger.requestLog(
      `Updated file-hasher based on watched changes, recomputing project graph...`
    );
    serverLogger.requestLog([...updatedFiles.values()]);
    serverLogger.requestLog([...deletedFiles]);

    // when workspace config changes we cannot incrementally update project file map
    if (workspaceConfigHash !== storedWorkspaceConfigHash) {
      storedWorkspaceConfigHash = workspaceConfigHash;

      ({ externalNodes: knownExternalNodes, ...fileMapWithFiles } =
        await retrieveWorkspaceFiles(workspaceRoot, nxJson));
    } else {
      if (fileMapWithFiles) {
        fileMapWithFiles = updateFileMap(
          projectNodes,
          fileMapWithFiles.fileMap,
          fileMapWithFiles.allWorkspaceFiles,
          new Map(Object.entries(updatedFileHashes)),
          deletedFiles
        );
      } else {
        fileMapWithFiles = await retrieveWorkspaceFiles(workspaceRoot, nxJson);
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
    return e;
  }
}

async function processFilesAndCreateAndSerializeProjectGraph() {
  const err = await processCollectedUpdatedAndDeletedFiles();
  if (err) {
    return Promise.resolve({
      error: err,
      projectGraph: null,
      fileMap: null,
      allWorkspaceFiles: null,
      serializedProjectGraph: null,
    });
  } else {
    return createAndSerializeProjectGraph();
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

async function createAndSerializeProjectGraph(): Promise<{
  error: string | null;
  projectGraph: ProjectGraph | null;
  fileMap: FileMap | null;
  allWorkspaceFiles: FileData[] | null;
  serializedProjectGraph: string | null;
}> {
  try {
    performance.mark('create-project-graph-start');
    const projectConfigurations = await retrieveProjectConfigurations(
      workspaceRoot,
      readNxJson(workspaceRoot)
    );
    const fileMap = copyFileMap(fileMapWithFiles.fileMap);
    const allWorkspaceFiles = copyFileData(fileMapWithFiles.allWorkspaceFiles);
    const { projectGraph, projectFileMapCache } =
      await buildProjectGraphUsingFileMap(
        projectConfigurations.projectNodes,
        knownExternalNodes,
        fileMap,
        allWorkspaceFiles,
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
