import type { Target } from '../command-line/run/run';
import { NxJsonConfiguration, TargetDependencies } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { HashInputs } from '../native';
export declare class HashPlanInspector {
    private projectGraph;
    private readonly workspaceRootPath;
    private readonly projectGraphRef;
    private planner;
    private inspector;
    private readonly nxJson;
    constructor(projectGraph: ProjectGraph, workspaceRootPath?: string, nxJson?: NxJsonConfiguration);
    init(): Promise<void>;
    /**
     * This is a lower level method which will inspect the hash plan for a set of tasks.
     */
    inspectHashPlan(projectNames: string[], targets: string[], configuration?: string, overrides?: Record<string, unknown>, extraTargetDependencies?: TargetDependencies, excludeTaskDependencies?: boolean): Record<string, string[]>;
    /**
     * This inspects tasks involved in the execution of a task, including its dependencies by default.
     * @deprecated Prefer inspectTaskInputs
     */
    inspectTask({ project, target, configuration }: Target, parsedArgs?: {
        [k: string]: any;
    }, extraTargetDependencies?: Record<string, (TargetDependencyConfig | string)[]>, excludeTaskDependencies?: boolean): Record<string, string[]>;
    /**
     * Like inspectTask() but returns structured HashInputs objects instead of flat strings.
     * Each input is categorized into files, runtime, environment, depOutputs, or external.
     */
    inspectTaskInputs({ project, target, configuration }: Target, parsedArgs?: {
        [k: string]: any;
    }, extraTargetDependencies?: Record<string, (TargetDependencyConfig | string)[]>, excludeTaskDependencies?: boolean): Record<string, HashInputs>;
}
