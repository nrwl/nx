import type { Observable } from 'rxjs';
import type { NxJsonConfiguration, ProjectGraph, Task } from '@nrwl/devkit';

// Exported for backwards compatibility
export type { Task } from '@nrwl/devkit';

export enum AffectedEventType {
  TaskComplete = '[Task] Complete',
  TaskCacheRead = '[Task] CacheRead',
  TaskDependencyFailed = '[Task] DependencyFailed',
}

export interface AffectedEvent {
  task: Task;
  type: AffectedEventType;
}

export interface TaskCompleteEvent extends AffectedEvent {
  type: AffectedEventType.TaskComplete;
  success: boolean;
}

export type TasksRunner<T = unknown> = (
  tasks: Task[],
  options: T,
  context?: {
    target?: string;
    initiatingProject?: string | null;
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
    hideCachedOutput?: boolean;
  }
) => Observable<AffectedEvent>;
