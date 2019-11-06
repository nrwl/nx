import { Observable } from 'rxjs';
import { Target } from '@angular-devkit/architect';

import { DependencyGraph } from '../command-line/shared-models';

export interface Task {
  id: string;
  target: Target;
  overrides: Object;
}

export enum TaskEventType {
  TaskComplete = '[Task] Complete'
}

export interface TaskEvent {
  task: Task;
  type: TaskEventType;
}

export interface TaskCompleteEvent extends TaskEvent {
  type: TaskEventType.TaskComplete;
  success: boolean;
}

export type TasksRunner<T = unknown> = (
  tasks: Task[],
  options?: T,
  context?: {
    dependencyGraph: DependencyGraph;
    tasksMap: {
      [projectName: string]: {
        [targetName: string]: Task;
      };
    };
  }
) => Observable<TaskEvent>;
