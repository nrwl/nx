import { Task, TaskGraph } from '../../config/task-graph';
import type { LifeCycle } from '../life-cycle';
export declare function getTuiTerminalSummaryLifeCycle({ projectNames, tasks, taskGraph, args, overrides, initiatingProject, initiatingTasks, resolveRenderIsDonePromise, }: {
    projectNames: string[];
    tasks: Task[];
    taskGraph: TaskGraph;
    args: {
        targets?: string[];
        configuration?: string;
        parallel?: number;
    };
    overrides: Record<string, unknown>;
    initiatingProject: string;
    initiatingTasks: Task[];
    resolveRenderIsDonePromise: (value: void) => void;
}): {
    lifeCycle: LifeCycle;
    printSummary: () => void;
};
