import { getRunningTasksService } from '../../utils/running-tasks';

export async function handleGetRunningTasks(ids: string[]) {
  const service = getRunningTasksService();
  const runningTasks = (await service?.getRunningTasks(ids)) ?? [];
  return {
    response: JSON.stringify(runningTasks),
    description: 'handleGetRunningTasks',
  };
}

export async function handleAddRunningTask(taskId: string) {
  const service = getRunningTasksService();
  await service?.addRunningTask(taskId);
  return {
    response: 'true',
    description: 'handleAddRunningTask',
  };
}

export async function handleRemoveRunningTask(taskId: string) {
  const service = getRunningTasksService();
  await service?.removeRunningTask(taskId);
  return {
    response: 'true',
    description: 'handleRemoveRunningTask',
  };
}
