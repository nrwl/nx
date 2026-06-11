import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { TaskDetails } from '../native';
import { TaskHasher } from './task-hasher';
export declare function getTaskDetails(): TaskDetails | null;
export declare function hashTasksThatDoNotDependOnOutputsOfOtherTasks(hasher: TaskHasher, projectGraph: ProjectGraph, taskGraph: TaskGraph, nxJson: NxJsonConfiguration, tasksDetails: TaskDetails | null): Promise<void>;
export declare function hashTask(hasher: TaskHasher, projectGraph: ProjectGraph, taskGraph: TaskGraph, task: Task, env: NodeJS.ProcessEnv, taskDetails: TaskDetails | null): Promise<void>;
/**
 * Batch-hash `tasks`. `perTaskEnvs` must contain an entry keyed by
 * `task.id` for every task — the per-task env is what each task's
 * custom hasher sees and what the built-in hasher reads
 * `HashInstruction::Environment` inputs against. Callers that
 * genuinely want to hash against a single shared env should build
 * `{ [task.id]: env }` for every task.
 */
export declare function hashTasks(hasher: TaskHasher, projectGraph: ProjectGraph, taskGraph: TaskGraph, perTaskEnvs: Record<string, NodeJS.ProcessEnv>, taskDetails: TaskDetails | null, tasksToHashOverride?: Task[]): Promise<void>;
