import type { HandlerResult } from './server';
import type { RunningTaskStatusUpdate } from '../message-types/running-tasks';

const MAX_OUTPUT_LINES = 100;

interface RunningTaskState {
  status: string;
  continuous: boolean;
  startTime?: string;
  endTime?: string;
}

interface RunningProcessState {
  pid: number;
  command: string;
  startTime: string;
  tasks: Record<string, RunningTaskState>;
}

const runningProcesses: Map<number, RunningProcessState> = new Map();
const outputBuffers: Map<string, string[]> = new Map();

function bufferKey(pid: number, taskId: string): string {
  return `${pid}:${taskId}`;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function pruneDeadProcesses(): void {
  for (const [pid] of runningProcesses) {
    if (!isProcessAlive(pid)) {
      cleanupProcess(pid);
    }
  }
}

function cleanupProcess(pid: number): void {
  const state = runningProcesses.get(pid);
  if (state) {
    for (const taskId of Object.keys(state.tasks)) {
      outputBuffers.delete(bufferKey(pid, taskId));
    }
  }
  runningProcesses.delete(pid);
}

function appendToRingBuffer(key: string, text: string): void {
  if (!outputBuffers.has(key)) {
    outputBuffers.set(key, []);
  }
  const buffer = outputBuffers.get(key);
  const lines = text.split('\n');
  // If the text ends with \n, the last element is empty string — don't store it
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  buffer.push(...lines);
  if (buffer.length > MAX_OUTPUT_LINES) {
    buffer.splice(0, buffer.length - MAX_OUTPUT_LINES);
  }
}

export async function handleRegisterRunningTasks(
  pid: number,
  command: string,
  taskIds: string[]
): Promise<HandlerResult> {
  const tasks: Record<string, RunningTaskState> = {};
  for (const id of taskIds) {
    tasks[id] = { status: 'not-started', continuous: false };
  }
  runningProcesses.set(pid, {
    pid,
    command,
    startTime: new Date().toISOString(),
    tasks,
  });
  return {
    response: '{}',
    description: 'handleRegisterRunningTasks',
  };
}

export async function handleUpdateRunningTasks(
  pid: number,
  taskUpdates: RunningTaskStatusUpdate[],
  outputChunks: Record<string, string>
): Promise<HandlerResult> {
  const state = runningProcesses.get(pid);
  if (!state) {
    return {
      response: '{}',
      description: 'handleUpdateRunningTasks (no process found)',
    };
  }

  for (const update of taskUpdates) {
    if (!state.tasks[update.id]) {
      state.tasks[update.id] = { status: 'not-started', continuous: false };
    }
    state.tasks[update.id].status = update.status;
    if (update.continuous !== undefined) {
      state.tasks[update.id].continuous = update.continuous;
    }
    if (update.startTime) {
      state.tasks[update.id].startTime = update.startTime;
    }
    if (update.endTime) {
      state.tasks[update.id].endTime = update.endTime;
    }
  }

  for (const [taskId, chunk] of Object.entries(outputChunks)) {
    appendToRingBuffer(bufferKey(pid, taskId), chunk);
  }

  return {
    response: '{}',
    description: 'handleUpdateRunningTasks',
  };
}

export async function handleUnregisterRunningTasks(
  pid: number
): Promise<HandlerResult> {
  cleanupProcess(pid);
  return {
    response: '{}',
    description: 'handleUnregisterRunningTasks',
  };
}

export async function handleGetRunningTasks(): Promise<HandlerResult> {
  pruneDeadProcesses();
  const result = Array.from(runningProcesses.values());
  return {
    response: JSON.stringify(result),
    description: 'handleGetRunningTasks',
  };
}

export async function handleGetRunningTaskOutput(
  pid: number,
  taskId: string
): Promise<HandlerResult> {
  const key = bufferKey(pid, taskId);
  const buffer = outputBuffers.get(key) ?? [];
  return {
    response: JSON.stringify(buffer.join('\n')),
    description: 'handleGetRunningTaskOutput',
  };
}

// Exported for testing
export function clearRunningProcesses(): void {
  runningProcesses.clear();
  outputBuffers.clear();
}
