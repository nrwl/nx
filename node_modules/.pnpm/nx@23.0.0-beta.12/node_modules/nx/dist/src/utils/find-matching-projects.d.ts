import type { ProjectGraphProjectNode } from '../config/project-graph';
/**
 * Find matching project names given a list of potential project names or globs.
 *
 * @param patterns A list of project names or globs to match against.
 * @param projects A map of {@link ProjectGraphProjectNode} by project name.
 * @returns
 */
export declare function findMatchingProjects(patterns: string[], projects: Record<string, ProjectGraphProjectNode>): string[];
export declare const getMatchingStringsWithCache: (pattern: string, items: string[]) => string[];
