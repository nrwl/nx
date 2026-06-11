import type { PostTasksExecutionContext, PreTasksExecutionContext } from '../../project-graph/plugins';
export declare const PRE_TASKS_EXECUTION: "PRE_TASKS_EXECUTION";
export declare const POST_TASKS_EXECUTION: "POST_TASKS_EXECUTION";
export type HandlePreTasksExecutionMessage = {
    type: typeof PRE_TASKS_EXECUTION;
    context: PreTasksExecutionContext;
};
export type HandlePostTasksExecutionMessage = {
    type: typeof POST_TASKS_EXECUTION;
    context: PostTasksExecutionContext;
};
export declare function isHandlePreTasksExecutionMessage(message: unknown): message is HandlePreTasksExecutionMessage;
export declare function isHandlePostTasksExecutionMessage(message: unknown): message is HandlePostTasksExecutionMessage;
