import type { HashedTask } from '../../native';
import { getTaskDetails } from '../../hasher/task-details-recorder';

export async function handleRecordTaskDetails(taskDetails: HashedTask[]) {
  const recorder = getTaskDetails();
  if (recorder) {
    await recorder.recordTaskDetails(taskDetails);
  }
  return {
    response: 'true',
    description: 'handleRecordTaskDetails',
  };
}
