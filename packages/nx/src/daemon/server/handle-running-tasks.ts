import { getRunningTasksService } from '../../utils/running-tasks';

export async function handleGetRunningTasks(ids: string[]) {
  const service = getRunningTasksService();
  return {
    response: JSON.stringify(service?.getRunningTasks(ids) ?? []),
    description: 'handleGetRunningTasks',
  };
}

export async function handleAddRunningTask(taskId: string) {
  const service = getRunningTasksService();
  service?.addRunningTask(taskId);
  return {
    response: 'true',
    description: 'handleAddRunningTask',
  };
}

export async function handleRemoveRunningTask(taskId: string) {
  const service = getRunningTasksService();
  service?.removeRunningTask(taskId);
  return {
    response: 'true',
    description: 'handleRemoveRunningTask',
  };
}
