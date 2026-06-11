import { NormalizedPackageJson } from './utils/package-json';
import { RawProjectGraphDependency } from '../../../project-graph/project-graph-builder';
import { ProjectGraph, ProjectGraphExternalNode } from '../../../config/project-graph';
import { CreateDependenciesContext } from '../../../project-graph/plugins';
export declare function getPnpmLockfileNodes(lockFileContent: string, lockFileHash: string): {
    nodes: Record<string, ProjectGraphExternalNode>;
    keyMap: Map<string, Set<ProjectGraphExternalNode>>;
};
export declare function getPnpmLockfileDependencies(lockFileContent: string, lockFileHash: string, ctx: CreateDependenciesContext, keyMap: Map<string, Set<ProjectGraphExternalNode>>): RawProjectGraphDependency[];
export declare function stringifyPnpmLockfile(graph: ProjectGraph, rootLockFileContent: string, packageJson: NormalizedPackageJson, workspaceRoot: string): string;
