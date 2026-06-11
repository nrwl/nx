import { ProjectGraph, ProjectGraphExternalNode, ProjectGraphProjectNode } from '../../../config/project-graph';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';
import { PackageJson } from '../../../utils/package-json';
/**
 * Prune project graph's external nodes and their dependencies
 * based on the pruned package.json
 */
export declare function pruneProjectGraph(graph: ProjectGraph, prunedPackageJson: PackageJson, workspaceRootPath?: string): ProjectGraph;
export declare function findNodeMatchingVersion(graph: ProjectGraph, packageName: string, versionExpr: string): ProjectGraphExternalNode;
export declare function addNodesAndDependencies(graph: ProjectGraph, packageJsonDeps: Record<string, string>, workspacePackages: Map<string, ProjectGraphProjectNode>, builder: ProjectGraphBuilder): void;
export declare function rehoistNodes(graph: ProjectGraph, packageJsonDeps: Record<string, string>, builder: ProjectGraphBuilder): void;
