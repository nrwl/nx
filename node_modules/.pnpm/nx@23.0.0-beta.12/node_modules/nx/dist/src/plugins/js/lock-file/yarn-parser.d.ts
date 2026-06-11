import { NormalizedPackageJson } from './utils/package-json';
import { RawProjectGraphDependency } from '../../../project-graph/project-graph-builder';
import { ProjectGraph, ProjectGraphExternalNode } from '../../../config/project-graph';
import { CreateDependenciesContext } from '../../../project-graph/plugins';
export declare function getYarnLockfileNodes(lockFileContent: string, lockFileHash: string, packageJson: NormalizedPackageJson): {
    nodes: Record<string, ProjectGraphExternalNode>;
    keyMap: Map<string, ProjectGraphExternalNode>;
};
export declare function getYarnLockfileDependencies(lockFileContent: string, lockFileHash: string, ctx: CreateDependenciesContext, keyMap: Map<string, ProjectGraphExternalNode>): RawProjectGraphDependency[];
export declare function stringifyYarnLockfile(graph: ProjectGraph, rootLockFileContent: string, packageJson: NormalizedPackageJson): string;
