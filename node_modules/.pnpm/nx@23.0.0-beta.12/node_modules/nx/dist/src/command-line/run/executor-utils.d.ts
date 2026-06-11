import { ExecutorConfig } from '../../config/misc-interfaces';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
export declare function normalizeExecutorSchema(schema: Partial<ExecutorConfig['schema']>): ExecutorConfig['schema'];
export declare function parseExecutor(executorString: string): [module: string, name: string];
export declare function getExecutorInformation(nodeModule: string, executor: string, root: string, 
/**
 * A map of projects keyed by project name
 */
projects: Record<string, ProjectConfiguration>): ExecutorConfig & {
    isNgCompat: boolean;
    isNxExecutor: boolean;
};
