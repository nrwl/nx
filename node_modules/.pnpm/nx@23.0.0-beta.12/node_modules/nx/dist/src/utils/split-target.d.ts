import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
export interface SplitTargetOptions {
    silent?: boolean;
    currentProject?: string;
}
export declare function splitTargetFromNodes(s: string, nodes: Record<string, ProjectGraphProjectNode>, options?: SplitTargetOptions): [project: string, target?: string, configuration?: string];
/**
 * Splits a colon-delimited target specifier using a name-keyed
 * `Record<string, ProjectConfiguration>` — the format used during
 * the merge phase before the full project graph is available.
 */
export declare function splitTargetFromConfigurations(s: string, configs: Record<string, ProjectConfiguration>, options?: SplitTargetOptions): [project: string, target?: string, configuration?: string];
export declare function splitTarget(s: string, projectGraph: ProjectGraph, options?: SplitTargetOptions): [project: string, target?: string, configuration?: string];
export declare function splitByColons(s: string): [string, ...string[]];
