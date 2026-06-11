import type { NxArgs } from '../../utils/command-line-utils';
import { ProjectGraph, ProjectGraphProjectNode } from '../../config/project-graph';
import { TargetDependencyConfig } from '../../config/workspace-json-project-json';
export declare function affected(command: 'graph' | 'print-affected' | 'affected', args: {
    [k: string]: any;
}, extraTargetDependencies?: Record<string, (TargetDependencyConfig | string)[]>, extraOptions?: {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
}): Promise<void>;
export declare function getAffectedGraphNodes(nxArgs: NxArgs, projectGraph: ProjectGraph): Promise<ProjectGraphProjectNode[]>;
