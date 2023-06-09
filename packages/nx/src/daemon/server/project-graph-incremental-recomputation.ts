import { performance } from 'perf_hooks';
import {
  FileData,
  ProjectFileMap,
  ProjectGraph,
} from '../../config/project-graph';
import { buildProjectGraphUsingProjectFileMap } from '../../project-graph/build-project-graph';
import { updateProjectFileMap } from '../../project-graph/file-map-utils';
import {
  nxProjectGraph,
  ProjectFileMapCache,
  readProjectFileMapCache,
} from '../../project-graph/nx-deps-cache';
import { fileExists } from '../../utils/fileutils';
import { notifyFileWatcherSockets } from './file-watching/file-watcher-sockets';
import { serverLogger } from './logger';
import { Workspaces } from '../../config/workspaces';
import { workspaceRoot } from '../../utils/workspace-root';
import { execSync } from 'child_process';
import { fileHasher, hashArray } from '../../hasher/file-hasher';
import {
  retrieveWorkspaceFiles,
  retrieveProjectConfigurations,
} from '../../project-graph/utils/retrieve-workspace-files';

let cachedSerializedProjectGraphPromise: Promise<{
  error: Error | null;
  projectGraph: ProjectGraph | null;
  projectFileMap: ProjectFileMap | null;
  allWorkspaceFiles: FileData[] | null;
  serializedProjectGraph: string | null;
}>;
export let projectFileMapWithFiles:
  | { projectFileMap: ProjectFileMap; allWorkspaceFiles: FileData[] }
  | undefined;
export let currentProjectFileMapCache: ProjectFileMapCache | undefined;
export let currentProjectGraph: ProjectGraph | undefined;

const collectedUpdatedFiles = new Set<string>();
const collectedDeletedFiles = new Set<string>();
let storedWorkspaceConfigHash: string | undefined;
let waitPeriod = 100;
let scheduledTimeoutId;

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
      projectFileMap: null,
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

function computeWorkspaceConfigHash(projectsConfigurations: any) {
  return hashArray([JSON.stringify(projectsConfigurations)]);
}

/**
 * Temporary work around to handle nested gitignores. The parcel file watcher doesn't handle them well,
 * so we need to filter them out here.
 *
 * TODO(Cammisuli): remove after 16.4 - Rust watcher handles nested gitignores
 */
function filterUpdatedFiles(files: string[]) {
  try {
    const quoted = files.map((f) => '"' + f + '"');
    const ignored = execSync(`git check-ignore ${quoted.join(' ')}`, {
      windowsHide: true,
    })
      .toString()
      .split('\n');
    return files.filter((f) => ignored.indexOf(f) === -1);
  } catch (e) {
    // none of the files were ignored
    return files;
  }
}

async function processCollectedUpdatedAndDeletedFiles() {
  try {
    performance.mark('hash-watched-changes-start');
    const updatedFiles = await fileHasher.hashFiles(
      filterUpdatedFiles([...collectedUpdatedFiles.values()])
    );
    const deletedFiles = [...collectedDeletedFiles.values()];
    performance.mark('hash-watched-changes-end');
    performance.measure(
      'hash changed files from watcher',
      'hash-watched-changes-start',
      'hash-watched-changes-end'
    );
    fileHasher.incrementalUpdate(updatedFiles, deletedFiles);

    let nxJson = new Workspaces(workspaceRoot).readNxJson();

    const projectConfigurations = await retrieveProjectConfigurations(
      workspaceRoot,
      nxJson
    );

    const workspaceConfigHash = computeWorkspaceConfigHash(
      projectConfigurations
    );
    serverLogger.requestLog(
      `Updated file-hasher based on watched changes, recomputing project graph...`
    );
    serverLogger.requestLog([...updatedFiles.values()]);
    serverLogger.requestLog([...deletedFiles]);

    // when workspace config changes we cannot incrementally update project file map
    if (workspaceConfigHash !== storedWorkspaceConfigHash) {
      storedWorkspaceConfigHash = workspaceConfigHash;

      projectFileMapWithFiles = await retrieveWorkspaceFiles(
        workspaceRoot,
        nxJson
      );
    } else {
      if (projectFileMapWithFiles) {
        projectFileMapWithFiles = updateProjectFileMap(
          projectConfigurations,
          projectFileMapWithFiles.projectFileMap,
          projectFileMapWithFiles.allWorkspaceFiles,
          updatedFiles,
          deletedFiles
        );
      } else {
        projectFileMapWithFiles = await retrieveWorkspaceFiles(
          workspaceRoot,
          nxJson
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
    return e;
  }
}

async function processFilesAndCreateAndSerializeProjectGraph() {
  const err = await processCollectedUpdatedAndDeletedFiles();
  if (err) {
    return Promise.resolve({
      error: err,
      projectGraph: null,
      projectFileMap: null,
      allWorkspaceFiles: null,
      serializedProjectGraph: null,
    });
  } else {
    return createAndSerializeProjectGraph();
  }
}

function copyFileData(d: FileData[]) {
  return d.map((t) => ({ ...t }));
}

function copyFileMap(m: ProjectFileMap) {
  const c = {};
  for (let p of Object.keys(m)) {
    c[p] = copyFileData(m[p]);
  }
  return c;
}

async function createAndSerializeProjectGraph(): Promise<{
  error: string | null;
  projectGraph: ProjectGraph | null;
  projectFileMap: ProjectFileMap | null;
  allWorkspaceFiles: FileData[] | null;
  serializedProjectGraph: string | null;
}> {
  try {
    performance.mark('create-project-graph-start');
    const projectsConfigurations = new Workspaces(
      workspaceRoot
    ).readProjectsConfigurations();
    const projectFileMap = copyFileMap(projectFileMapWithFiles.projectFileMap);
    const allWorkspaceFiles = copyFileData(
      projectFileMapWithFiles.allWorkspaceFiles
    );
    const { projectGraph, projectFileMapCache } =
      await buildProjectGraphUsingProjectFileMap(
        projectsConfigurations,
        projectFileMap,
        allWorkspaceFiles,
        currentProjectFileMapCache || readProjectFileMapCache(),
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
      projectFileMap,
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
      projectFileMap: null,
      allWorkspaceFiles: null,
      serializedProjectGraph: null,
    };
  }
}

async function resetInternalState() {
  cachedSerializedProjectGraphPromise = undefined;
  projectFileMapWithFiles = undefined;
  currentProjectFileMapCache = undefined;
  currentProjectGraph = undefined;
  collectedUpdatedFiles.clear();
  collectedDeletedFiles.clear();
  fileHasher.clear();
  await fileHasher.ensureInitialized();
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
