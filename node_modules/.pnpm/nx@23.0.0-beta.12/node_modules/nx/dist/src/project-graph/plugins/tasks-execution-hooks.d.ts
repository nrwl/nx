import type { PostTasksExecutionContext, PreTasksExecutionContext } from './public-api';
export declare function runPreTasksExecution(pluginContext: PreTasksExecutionContext): Promise<NodeJS.ProcessEnv[]>;
export declare function runPostTasksExecution(context: PostTasksExecutionContext): Promise<void>;
