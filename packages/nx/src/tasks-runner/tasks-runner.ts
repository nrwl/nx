import type { Observable } from 'rxjs';
import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { Task } from '../config/task-graph';

export type TaskStatus =
  | 'success'
  | 'failure'
  | 'skipped'
  | 'local-cache-kept-existing'
  | 'local-cache'
  | 'remote-cache';

/**
 * @deprecated Return Promise<{[id: string]: TaskStatus}> from the tasks runner
 *
 * Remove after Nx 14
 */
export enum AffectedEventType {
  TaskComplete = '[Task] Complete',
  TaskCacheRead = '[Task] CacheRead',
  TaskDependencyFailed = '[Task] DependencyFailed',
}

/**
 * @deprecated Return Promise<{[id: string]: TaskStatus}> from the tasks runner
 *
 * Remove after Nx 14
 */
export interface AffectedEvent {
  task: Task;
  type: AffectedEventType;
  success: boolean;
}

/**
 * @deprecated Return Promise<{[id: string]: TaskStatus}> from the tasks runner
 *
 * Remove after Nx 14
 */
export interface TaskCompleteEvent extends AffectedEvent {
  type: AffectedEventType.TaskComplete;
}

/**
 * `Observable<AffectedEvent> | Promise<{ [id: string]: TaskStatus }>`
 * will change to Promise<{ [id: string]: TaskStatus }> after Nx 15 is released.
 */
export type TasksRunner<T = unknown> = (
  tasks: Task[],
  options: T,
  context?: {
    target?: string;
    initiatingProject?: string | null;
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
  }
) => Observable<AffectedEvent> | Promise<{ [id: string]: TaskStatus }>;
