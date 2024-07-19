import { TaskRun, writeTaskRunsToHistory } from '../../utils/task-history';

export async function handleWriteTaskRunsToHistory(taskRuns: TaskRun[]) {
  await writeTaskRunsToHistory(taskRuns);
  return {
    response: 'true',
    description: 'handleWriteTaskRunsToHistory',
  };
}
