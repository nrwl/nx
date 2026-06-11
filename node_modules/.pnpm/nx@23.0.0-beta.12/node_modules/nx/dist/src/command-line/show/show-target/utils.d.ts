import type { NxJsonConfiguration } from '../../../config/nx-json';
import type { ProjectGraph } from '../../../config/project-graph';
import type { ConfigurationSourceMaps } from '../../../project-graph/utils/project-configuration/source-maps';
import type { ShowTargetBaseOptions, ShowTargetInputsOptions } from '../command-object';
export interface ResolvedTarget {
    graph: ProjectGraph;
    nxJson: NxJsonConfiguration;
    projectName: string;
    targetName: string;
    configuration: string | undefined;
    node: ProjectGraph['nodes'][string];
    sourceMaps?: ConfigurationSourceMaps;
}
export declare function resolveTarget(args: ShowTargetBaseOptions | ShowTargetInputsOptions, opts?: {
    withSourceMaps?: boolean;
}): Promise<ResolvedTarget>;
/**
 * Checks whether a target's executor defines a custom hasher.
 * Returns true if the executor has a hasherFactory — meaning the
 * standard input-based hashing is bypassed for this target.
 */
export declare function hasCustomHasher(projectName: string, targetName: string, graph: ProjectGraph): boolean;
export declare function normalizePath(p: string): string;
export declare function deduplicateFolderEntries(items: string[]): string[];
export declare function pc(): any;
export declare function printList(header: string, items: unknown[], prefix?: string): void;
