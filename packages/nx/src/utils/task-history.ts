import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { daemonClient } from '../daemon/client/client';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { workspaceDataDirectory } from './cache-directory';

const taskRunKeys = [
  'project',
  'target',
  'configuration',
  'hash',
  'code',
  'status',
  'start',
  'end',
] as const;

export type TaskRun = Record<(typeof taskRunKeys)[number], string>;

let taskHistory: TaskRun[] | undefined = undefined;
let taskHashToIndicesMap: Map<string, number[]> = new Map();

export async function getHistoryForHashes(hashes: string[]): Promise<{
  [hash: string]: TaskRun[];
}> {
  if (isOnDaemon() || !daemonClient.enabled()) {
    if (taskHistory === undefined) {
      loadTaskHistoryFromDisk();
    }

    const result: { [hash: string]: TaskRun[] } = {};
    for (let hash of hashes) {
      const indices = taskHashToIndicesMap.get(hash);
      if (!indices) {
        result[hash] = [];
      } else {
        result[hash] = indices.map((index) => taskHistory[index]);
      }
    }

    return result;
  }

  return await daemonClient.getTaskHistoryForHashes(hashes);
}

export async function writeTaskRunsToHistory(
  taskRuns: TaskRun[]
): Promise<void> {
  if (isOnDaemon() || !daemonClient.enabled()) {
    if (taskHistory === undefined) {
      loadTaskHistoryFromDisk();
    }

    const serializedLines: string[] = [];
    for (let taskRun of taskRuns) {
      const serializedLine = taskRunKeys.map((key) => taskRun[key]).join(',');
      serializedLines.push(serializedLine);
      recordTaskRunInMemory(taskRun);
    }

    if (!existsSync(taskHistoryFile)) {
      writeFileSync(taskHistoryFile, `${taskRunKeys.join(',')}\n`);
    }
    appendFileSync(taskHistoryFile, serializedLines.join('\n') + '\n');
  } else {
    await daemonClient.writeTaskRunsToHistory(taskRuns);
  }
}

export const taskHistoryFile = join(workspaceDataDirectory, 'task-history.csv');

function loadTaskHistoryFromDisk() {
  taskHashToIndicesMap.clear();
  taskHistory = [];

  if (!existsSync(taskHistoryFile)) {
    return;
  }

  const fileContent = readFileSync(taskHistoryFile, 'utf8');
  if (!fileContent) {
    return;
  }
  const lines = fileContent.split('\n');

  // if there are no lines or just the header, return
  if (lines.length <= 1) {
    return;
  }

  const contentLines = lines.slice(1).filter((l) => l.trim() !== '');

  // read the values from csv format where each header is a key and the value is the value
  for (let line of contentLines) {
    const values = line.trim().split(',');

    const run: Partial<TaskRun> = {};
    taskRunKeys.forEach((header, index) => {
      run[header] = values[index];
    });

    recordTaskRunInMemory(run as TaskRun);
  }
}

function recordTaskRunInMemory(taskRun: TaskRun) {
  const index = taskHistory.push(taskRun) - 1;
  if (taskHashToIndicesMap.has(taskRun.hash)) {
    taskHashToIndicesMap.get(taskRun.hash).push(index);
  } else {
    taskHashToIndicesMap.set(taskRun.hash, [index]);
  }
}
