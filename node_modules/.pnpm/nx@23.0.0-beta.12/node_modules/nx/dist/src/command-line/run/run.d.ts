import { Schema } from '../../utils/params';
import { ProjectsConfigurations } from '../../config/workspace-json-project-json';
import { ExecutorContext } from '../../config/misc-interfaces';
import { TaskGraph } from '../../config/task-graph';
export interface Target {
    project: string;
    target: string;
    configuration?: string;
}
export declare function printRunHelp(opts: {
    project: string;
    target: string;
}, schema: Schema, plugin: {
    plugin: string;
    entity: string;
}): void;
export declare function validateProject(projects: ProjectsConfigurations, projectName: string): void;
/**
 * Loads and invokes executor.
 *
 * This is analogous to invoking executor from the terminal, with the exception
 * that the params aren't parsed from the string, but instead provided parsed already.
 *
 * Apart from that, it works the same way:
 *
 * - it will load the workspace configuration
 * - it will resolve the target
 * - it will load the executor and the schema
 * - it will load the options for the appropriate configuration
 * - it will run the validations and will set the default
 * - and, of course, it will invoke the executor
 *
 * Example:
 *
 * ```typescript
 * for await (const s of await runExecutor({project: 'myproj', target: 'serve'}, {watch: true}, context)) {
 *   // s.success
 * }
 * ```
 *
 * Note that the return value is a promise of an iterator, so you need to await before iterating over it.
 */
export declare function runExecutor<T extends {
    success: boolean;
}>(targetDescription: Target, overrides: {
    [k: string]: any;
}, context: ExecutorContext): Promise<AsyncIterableIterator<T>>;
export declare function printTargetRunHelp(targetDescription: Target, root: string): Promise<number>;
export declare function run(cwd: string, root: string, targetDescription: Target, overrides: {
    [k: string]: any;
}, isVerbose: boolean, taskGraph: TaskGraph): Promise<number>;
