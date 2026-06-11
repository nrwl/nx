import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import type { ProjectConfiguration } from '../config/workspace-json-project-json';
export declare function projectHasTarget(project: ProjectGraphProjectNode, target: string): boolean;
export declare function projectHasTargetAndConfiguration(project: ProjectGraphProjectNode, target: string, configuration: string): any;
export declare function getSourceDirOfDependentProjects(projectName: string, projectGraph?: ProjectGraph): [
    projectDirs: string[],
    warnings: string[]
];
/**
 * Find all internal project dependencies.
 * All the external (npm) dependencies will be filtered out unless includeExternalDependencies is set to true
 * @param {string} parentNodeName
 * @param {ProjectGraph} projectGraph
 * @param includeExternalDependencies
 * @returns {string[]}
 */
export declare function findAllProjectNodeDependencies(parentNodeName: string, projectGraph?: ProjectGraph, includeExternalDependencies?: boolean): string[];
export declare function getProjectSourceRoot(project: ProjectConfiguration): string | undefined;
