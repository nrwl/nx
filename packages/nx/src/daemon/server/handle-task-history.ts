import { getTaskHistory } from '../../utils/task-history';
import type { TaskRun, TaskTarget } from '../../native';

export async function handleRecordTaskRuns(taskRuns: TaskRun[]) {
  const taskHistory = getTaskHistory();
  if (!taskHistory) {
    throw new Error('Task history is not available');
  }
  await taskHistory.recordTaskRuns(taskRuns);
  return {
    response: 'true',
    description: 'handleRecordTaskRuns',
  };
}

export async function handleGetFlakyTasks(hashes: string[]) {
  const taskHistory = getTaskHistory();
  if (!taskHistory) {
    throw new Error('Task history is not available');
  }
  const history = await taskHistory.getFlakyTasks(hashes);
  return {
    response: history,
    description: 'handleGetFlakyTasks',
  };
}

export async function handleGetEstimatedTaskTimings(targets: TaskTarget[]) {
  const taskHistory = getTaskHistory();
  if (!taskHistory) {
    throw new Error('Task history is not available');
  }
  const history = await taskHistory.getEstimatedTaskTimings(targets);
  return {
    response: history,
    description: 'handleGetEstimatedTaskTimings',
  };
}
