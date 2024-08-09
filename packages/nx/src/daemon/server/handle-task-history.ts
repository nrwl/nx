import { TaskRun } from '../../native';
import { TaskHistory } from '../../utils/task-history';

const taskHistory = new TaskHistory();

export async function handleRecordTaskRuns(taskRuns: TaskRun[]) {
  await taskHistory.recordTaskRuns(taskRuns);
  return {
    response: 'true',
    description: 'handleRecordTaskRuns',
  };
}

export async function handleGetFlakyTasks(hashes: string[]) {
  const history = await taskHistory.getFlakyTasks(hashes);
  return {
    response: JSON.stringify(history),
    description: 'handleGetFlakyTasks',
  };
}
