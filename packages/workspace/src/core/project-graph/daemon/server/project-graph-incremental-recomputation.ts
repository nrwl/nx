import { FileData, ProjectFileMap } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { performance } from 'perf_hooks';
import {
  createProjectFileMap,
  readWorkspaceJson,
  updateProjectFileMap,
} from '../../../file-utils';
import { defaultFileHasher } from '../../../hasher/file-hasher';
import { getGitHashForFiles } from '../../../hasher/git-hasher';
import { serverLogger } from './logger';
import { buildProjectGraphUsingProjectFileMap } from '../../build-project-graph';
import { workspaceConfigName } from '@nrwl/tao/src/shared/workspace';
import {
  nxDepsPath,
  ProjectGraphCache,
  readCache,
} from '../../../nx-deps/nx-deps-cache';
import { fileExists } from '../../../../utilities/fileutils';

const configName = workspaceConfigName(appRootPath);
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
let waitPeriod = 100;
let scheduledTimeoutId;

export function getCachedSerializedProjectGraphPromise() {
  // recomputing it now on demand. we can ignore the scheduled timeout
  if (scheduledTimeoutId) {
    clearTimeout(scheduledTimeoutId);
    scheduledTimeoutId = undefined;
  }

  // reset the wait time
  waitPeriod = 100;
  resetInternalStateIfNxDepsMissing();
  if (collectedUpdatedFiles.size == 0 && collectedDeletedFiles.size == 0) {
    if (!cachedSerializedProjectGraphPromise) {
      processCollectedUpdatedAndDeletedFiles(); // this creates a project graph
      cachedSerializedProjectGraphPromise = createAndSerializeProjectGraph();
    }
  } else {
    processCollectedUpdatedAndDeletedFiles();
    cachedSerializedProjectGraphPromise = createAndSerializeProjectGraph();
  }
  return cachedSerializedProjectGraphPromise;
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
      processCollectedUpdatedAndDeletedFiles();
      cachedSerializedProjectGraphPromise = createAndSerializeProjectGraph();
    }, waitPeriod);
  }
}

function processCollectedUpdatedAndDeletedFiles() {
  performance.mark('hash-watched-changes-start');
  const updatedFiles = getGitHashForFiles(
    [...collectedUpdatedFiles.values()],
    appRootPath
  );
  const deletedFiles = [...collectedDeletedFiles.values()];
  collectedUpdatedFiles.clear();
  collectedDeletedFiles.clear();

  performance.mark('hash-watched-changes-end');
  performance.measure(
    'hash changed files from watcher',
    'hash-watched-changes-start',
    'hash-watched-changes-end'
  );
  defaultFileHasher.incrementalUpdate(updatedFiles, deletedFiles);
  const workspaceJson = readWorkspaceJson();
  serverLogger.nestedLog(
    `Updated file-hasher based on watched changes, recomputing project graph...`
  );
  // when workspace.json changes we cannot be sure about the correctness of the project file map
  if (
    collectedUpdatedFiles.has(configName) ||
    collectedDeletedFiles.has(configName)
  ) {
    projectFileMapWithFiles = createProjectFileMap(workspaceJson);
  } else {
    projectFileMapWithFiles = projectFileMapWithFiles
      ? updateProjectFileMap(
          workspaceJson,
          projectFileMapWithFiles.projectFileMap,
          projectFileMapWithFiles.allWorkspaceFiles,
          updatedFiles,
          deletedFiles
        )
      : createProjectFileMap(workspaceJson);
  }
}

async function createAndSerializeProjectGraph() {
  try {
    performance.mark('create-project-graph-start');
    const workspaceJson = readWorkspaceJson();
    const { projectGraph, projectGraphCache } =
      await buildProjectGraphUsingProjectFileMap(
        workspaceJson,
        projectFileMapWithFiles.projectFileMap,
        projectFileMapWithFiles.allWorkspaceFiles,
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
  } catch (err) {
    return {
      error: err,
      serializedProjectGraph: null,
    };
  }
}

export function resetInternalState() {
  cachedSerializedProjectGraphPromise = undefined;
  projectFileMapWithFiles = undefined;
  currentProjectGraphCache = undefined;
  collectedUpdatedFiles.clear();
  collectedDeletedFiles.clear();
  waitPeriod = 100;
}

function resetInternalStateIfNxDepsMissing() {
  try {
    if (!fileExists(nxDepsPath)) {
      resetInternalState();
    }
  } catch (e) {
    resetInternalState();
  }
}
