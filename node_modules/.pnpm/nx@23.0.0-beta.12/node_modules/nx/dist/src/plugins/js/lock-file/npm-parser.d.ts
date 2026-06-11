import { NormalizedPackageJson } from './utils/package-json';
import { RawProjectGraphDependency } from '../../../project-graph/project-graph-builder';
import { ProjectGraph, ProjectGraphExternalNode } from '../../../config/project-graph';
import { CreateDependenciesContext } from '../../../project-graph/plugins';
export declare function getNpmLockfileNodes(lockFileContent: string, lockFileHash: string): {
    nodes: Record<string, ProjectGraphExternalNode>;
    keyMap: Map<string, ProjectGraphExternalNode>;
};
export declare function getNpmLockfileDependencies(lockFileContent: string, lockFileHash: string, ctx: CreateDependenciesContext, keyMap: Map<string, ProjectGraphExternalNode>): RawProjectGraphDependency[];
export declare function stringifyNpmLockfile(graph: ProjectGraph, rootLockFileContent: string, packageJson: NormalizedPackageJson): string;
