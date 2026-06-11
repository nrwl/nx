import { NxArgs } from '../../utils/command-line-utils';
import { ProjectGraph, ProjectGraphProjectNode } from '../../config/project-graph';
import { TargetDependencyConfig } from '../../config/workspace-json-project-json';
export declare function runMany(args: {
    [k: string]: any;
}, extraTargetDependencies?: Record<string, (TargetDependencyConfig | string)[]>, extraOptions?: {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
}): Promise<void>;
export declare function projectsToRun(nxArgs: NxArgs, projectGraph: ProjectGraph): ProjectGraphProjectNode[];
