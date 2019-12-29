import { Observable } from 'rxjs';
import { Target } from '@angular-devkit/architect';

import { ProjectGraph } from '../core/project-graph';
import { NxJson } from '../core/shared-interfaces';

export interface Task {
  id: string;
  target: Target;
  overrides: Object;
}

export enum AffectedEventType {
  TaskComplete = '[Task] Complete',
  TaskCacheRead = '[Task] CacheRead'
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
    projectGraph: ProjectGraph;
    nxJson: NxJson;
  }
) => Observable<AffectedEvent>;
