import { Task, TaskGraph } from '../../config/task-graph';
export declare function handleHashTasks(payload: {
    runnerOptions: any;
    tasks: Task[];
    taskGraph: TaskGraph;
    perTaskEnvs: Record<string, NodeJS.ProcessEnv>;
    cwd: string;
    collectInputs?: boolean;
}): Promise<{
    response: import("../../hasher/task-hasher").Hash[];
    description: string;
}>;
