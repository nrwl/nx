import type { Observable } from 'rxjs';

import { ProjectGraph } from '../core/project-graph';
import { NxJson } from '../core/shared-interfaces';

export interface Task {
  id: string;
  target: { target: string; project: string; configuration?: string };
  overrides: any;
  hash?: string;
  projectRoot?: string;
  hashDetails?: {
    command: string;
    nodes: { [name: string]: string };
    implicitDeps: { [fileName: string]: string };
    runtime: { [input: string]: string };
  };
}

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
    nxJson: NxJson;
    hideCachedOutput?: boolean;
  }
) => Observable<AffectedEvent>;
