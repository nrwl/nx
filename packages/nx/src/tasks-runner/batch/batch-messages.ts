import type { TaskResult } from '../../config/misc-interfaces';
import type { TaskGraph } from '../../config/task-graph';

export enum BatchMessageType {
  RunTasks,
  CompleteTask,
  CompleteBatchExecution,
}

/**
 * Results of running the batch. Mapped from task id to results
 */
export interface BatchResults {
  [taskId: string]: TaskResult;
}
export interface BatchTaskResult {
  task: string;
  result: TaskResult;
}

export interface RunTasksMessage {
  type: BatchMessageType.RunTasks;
  executorName: string;
  batchTaskGraph: TaskGraph;
  fullTaskGraph: TaskGraph;
}

export interface CompleteTaskMessage {
  type: BatchMessageType.CompleteTask;
  task: string;
  result: TaskResult;
}

export interface CompleteBatchExecutionMessage {
  type: BatchMessageType.CompleteBatchExecution;
  results: BatchResults;
}

export type BatchMessage =
  | RunTasksMessage
  | CompleteTaskMessage
  | CompleteBatchExecutionMessage;
