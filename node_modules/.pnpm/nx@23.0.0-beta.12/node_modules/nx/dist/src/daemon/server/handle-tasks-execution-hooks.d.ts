import type { PostTasksExecutionContext, PreTasksExecutionContext } from '../../project-graph/plugins/public-api';
export declare function handleRunPreTasksExecution(context: PreTasksExecutionContext): Promise<{
    response: NodeJS.ProcessEnv[];
    description: string;
    error?: undefined;
} | {
    error: any;
    description: string;
    response?: undefined;
}>;
export declare function handleRunPostTasksExecution(context: PostTasksExecutionContext): Promise<{
    response: string;
    description: string;
    error?: undefined;
} | {
    error: any;
    description: string;
    response?: undefined;
}>;
