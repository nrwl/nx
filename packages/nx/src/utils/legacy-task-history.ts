import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
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
  const history = taskHistory ?? loadTaskHistoryFromDisk();

  const result: { [hash: string]: TaskRun[] } = {};
  for (let hash of hashes) {
    const indices = taskHashToIndicesMap.get(hash);
    if (!indices) {
      result[hash] = [];
    } else {
      result[hash] = indices.map((index) => history[index]);
    }
  }

  return result;
}

export async function writeTaskRunsToHistory(
  taskRuns: TaskRun[]
): Promise<void> {
  const history = taskHistory ?? loadTaskHistoryFromDisk();

  const serializedLines: string[] = [];
  for (let taskRun of taskRuns) {
    const serializedLine = taskRunKeys.map((key) => taskRun[key]).join(',');
    serializedLines.push(serializedLine);
    recordTaskRunInMemory(history, taskRun);
  }

  if (!existsSync(taskHistoryFile)) {
    writeFileSync(taskHistoryFile, `${taskRunKeys.join(',')}\n`);
  }
  appendFileSync(taskHistoryFile, serializedLines.join('\n') + '\n');
}

export const taskHistoryFile = join(workspaceDataDirectory, 'task-history.csv');

function loadTaskHistoryFromDisk(): TaskRun[] {
  taskHashToIndicesMap.clear();
  const history: TaskRun[] = [];
  taskHistory = history;

  if (!existsSync(taskHistoryFile)) {
    return history;
  }

  const fileContent = readFileSync(taskHistoryFile, 'utf8');
  if (!fileContent) {
    return history;
  }
  const lines = fileContent.split('\n');

  // if there are no lines or just the header, return
  if (lines.length <= 1) {
    return history;
  }

  const contentLines = lines.slice(1).filter((l) => l.trim() !== '');

  // read the values from csv format where each header is a key and the value is the value
  for (let line of contentLines) {
    const values = line.trim().split(',');

    const run: Partial<TaskRun> = {};
    taskRunKeys.forEach((header, index) => {
      run[header] = values[index];
    });

    recordTaskRunInMemory(history, run as TaskRun);
  }
  return history;
}

function recordTaskRunInMemory(history: TaskRun[], taskRun: TaskRun) {
  const index = history.push(taskRun) - 1;
  const indices = taskHashToIndicesMap.get(taskRun.hash);
  if (indices) {
    indices.push(index);
  } else {
    taskHashToIndicesMap.set(taskRun.hash, [index]);
  }
}
