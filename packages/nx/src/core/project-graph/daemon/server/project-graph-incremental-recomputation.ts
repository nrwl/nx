import { performance } from 'perf_hooks';
import { readWorkspaceJson } from '../../../file-utils';
import { defaultFileHasher } from '../../../hasher/file-hasher';
import { serverLogger } from './logger';
import { buildProjectGraphUsingProjectFileMap } from '../../build-project-graph';
import {
  nxDepsPath,
  ProjectGraphCache,
  readCache,
} from '../../../nx-deps/nx-deps-cache';
import { fileExists } from '../../../../utils/fileutils';
import { HashingImpl } from '../../../hasher/hashing-impl';
import {
  createProjectFileMap,
  updateProjectFileMap,
} from '../../../file-map-utils';
import { FileData, ProjectFileMap } from 'nx/src/shared/project-graph';

let cachedSerializedProjectGraphPromise: Promise<{
  error: Error | null;
  serializedProjectGraph: string | null;
}>;
let projectFileMapWithFiles:
  | { projectFileMap: ProjectFileMap; allWorkspaceFiles: FileData[] }
  | undefined;
let currentProjectGraphCache: ProjectGraphCache | undefined;

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
    return { error: e, serializedProjectGraph: null };
  }
}

export function addUpdatedAndDeletedFiles(
  updatedFiles: string[],
  deletedFiles: string[]
) {
  for (let f of updatedFiles) {
    collectedDeletedFiles.delete(f);
    collectedUpdatedFiles.add(f);
  }

  for (let f of deletedFiles) {
    collectedUpdatedFiles.delete(f);
    collectedDeletedFiles.add(f);
  }

  if (!scheduledTimeoutId) {
    scheduledTimeoutId = setTimeout(() => {
      scheduledTimeoutId = undefined;
      if (waitPeriod < 4000) {
        waitPeriod = waitPeriod * 2;
      }
      cachedSerializedProjectGraphPromise =
        processFilesAndCreateAndSerializeProjectGraph();
    }, waitPeriod);
  }
}

function computeWorkspaceConfigHash(workspaceJson: any) {
  return new HashingImpl().hashArray([JSON.stringify(workspaceJson)]);
}

async function processCollectedUpdatedAndDeletedFiles() {
  try {
    performance.mark('hash-watched-changes-start');
    const updatedFiles = await defaultFileHasher.hashFiles([
      ...collectedUpdatedFiles.values(),
    ]);
    const deletedFiles = [...collectedDeletedFiles.values()];
    performance.mark('hash-watched-changes-end');
    performance.measure(
      'hash changed files from watcher',
      'hash-watched-changes-start',
      'hash-watched-changes-end'
    );
    defaultFileHasher.incrementalUpdate(updatedFiles, deletedFiles);
    const workspaceJson = readWorkspaceJson();
    const workspaceConfigHash = computeWorkspaceConfigHash(workspaceJson);
    serverLogger.requestLog(
      `Updated file-hasher based on watched changes, recomputing project graph...`
    );
    // when workspace config changes we cannot incrementally update project file map
    if (workspaceConfigHash !== storedWorkspaceConfigHash) {
      storedWorkspaceConfigHash = workspaceConfigHash;
      projectFileMapWithFiles = createProjectFileMap(
        workspaceJson,
        defaultFileHasher.allFileData()
      );
    } else {
      projectFileMapWithFiles = projectFileMapWithFiles
        ? updateProjectFileMap(
            workspaceJson,
            projectFileMapWithFiles.projectFileMap,
            projectFileMapWithFiles.allWorkspaceFiles,
            updatedFiles,
            deletedFiles
          )
        : createProjectFileMap(workspaceJson, defaultFileHasher.allFileData());
    }

    collectedUpdatedFiles.clear();
    collectedDeletedFiles.clear();
  } catch (e) {
    // this is expected
    // for instance, workspace.json can be incorrect or a file we are trying to has
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

async function createAndSerializeProjectGraph() {
  try {
    performance.mark('create-project-graph-start');
    const workspaceJson = readWorkspaceJson();
    const { projectGraph, projectGraphCache } =
      await buildProjectGraphUsingProjectFileMap(
        workspaceJson,
        copyFileMap(projectFileMapWithFiles.projectFileMap),
        copyFileData(projectFileMapWithFiles.allWorkspaceFiles),
        currentProjectGraphCache || readCache(),
        true
      );
    currentProjectGraphCache = projectGraphCache;

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
      serializedProjectGraph,
    };
  } catch (e) {
    serverLogger.log(
      `Error detected when creating a project graph: ${e.message}`
    );
    return {
      error: e,
      serializedProjectGraph: null,
    };
  }
}

async function resetInternalState() {
  cachedSerializedProjectGraphPromise = undefined;
  projectFileMapWithFiles = undefined;
  currentProjectGraphCache = undefined;
  collectedUpdatedFiles.clear();
  collectedDeletedFiles.clear();
  defaultFileHasher.clear();
  await defaultFileHasher.ensureInitialized();
  waitPeriod = 100;
}

async function resetInternalStateIfNxDepsMissing() {
  try {
    if (!fileExists(nxDepsPath) && cachedSerializedProjectGraphPromise) {
      await resetInternalState();
    }
  } catch (e) {
    await resetInternalState();
  }
}
