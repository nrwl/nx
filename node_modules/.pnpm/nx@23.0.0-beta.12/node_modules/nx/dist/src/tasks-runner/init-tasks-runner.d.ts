import type { NxJsonConfiguration } from '../config/nx-json';
import { NxArgs } from '../utils/command-line-utils';
import { Task, TaskGraph } from '../config/task-graph';
import { LifeCycle, TaskResult } from './life-cycle';
import type { ProjectGraph } from '../config/project-graph';
import { RunningTask } from './running-tasks/running-task';
/**
 * This function is deprecated. Do not use this
 * @deprecated This function is deprecated. Do not use this
 */
export declare function initTasksRunner(nxArgs: NxArgs): Promise<{
    invoke: (opts: {
        tasks: Task[];
        parallel: number;
    }) => Promise<{
        status: NodeJS.Process["exitCode"];
        taskGraph: TaskGraph;
        taskResults: Record<string, TaskResult>;
    }>;
}>;
export declare function runDiscreteTasks(tasks: Task[], projectGraph: ProjectGraph, taskGraphForHashing: TaskGraph, nxJson: NxJsonConfiguration, lifeCycle: LifeCycle): Promise<Array<Promise<TaskResult[]>>>;
export declare function runContinuousTasks(tasks: Task[], projectGraph: ProjectGraph, taskGraphForHashing: TaskGraph, nxJson: NxJsonConfiguration, lifeCycle: LifeCycle): Promise<Record<string, Promise<RunningTask>>>;
