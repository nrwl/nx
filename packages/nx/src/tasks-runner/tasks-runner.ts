import { NxJsonConfiguration } from '../config/nx-json.js';
import { ProjectGraph } from '../config/project-graph.js';
import { Task, TaskGraph } from '../config/task-graph.js';
import { NxArgs } from '../utils/command-line-utils.js';
import { TaskHasher } from '../hasher/task-hasher.js';
import { DaemonClient } from '../daemon/client/client.js';

export type TaskStatus =
  | 'success'
  | 'failure'
  | 'skipped'
  | 'local-cache-kept-existing'
  | 'local-cache'
  | 'remote-cache';

/**
 * `any | Promise<{ [id: string]: TaskStatus }>`
 * will change to Promise<{ [id: string]: TaskStatus }> after Nx 15 is released.
 */
export type TasksRunner<T = unknown> = (
  tasks: Task[],
  options: T,
  context?: {
    target?: string;
    initiatingProject?: string | null;
    initiatingTasks: Task[];
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
    nxArgs: NxArgs;
    taskGraph?: TaskGraph;
    hasher?: TaskHasher;
    daemon?: DaemonClient;
  }
) => any | Promise<{ [id: string]: TaskStatus }>;
