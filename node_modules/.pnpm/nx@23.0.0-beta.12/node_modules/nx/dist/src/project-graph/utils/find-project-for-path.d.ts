import { ProjectGraphProjectNode } from '../../config/project-graph';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
export type ProjectRootMappings = Map<string, string>;
/**
 * This creates a map of project roots to project names to easily look up the project of a file
 * @param projects This is the map of project configurations commonly found in "workspace.json"
 */
export declare function createProjectRootMappingsFromProjectConfigurations(projects: Record<string, ProjectConfiguration>): ProjectRootMappings;
/**
 * This creates a map of project roots to project names to easily look up the project of a file
 * @param nodes This is the nodes from the project graph
 */
export declare function createProjectRootMappings(nodes: Record<string, ProjectGraphProjectNode>): ProjectRootMappings;
/**
 * Locates a project in projectRootMap based on a file within it
 * @param filePath path that is inside of projectName. This should be relative from the workspace root
 * @param projectRootMap Map<projectRoot, projectName> Use {@link createProjectRootMappings} to create this
 */
export declare function findProjectForPath(filePath: string, projectRootMap: ProjectRootMappings): string | null;
export declare function normalizeProjectRoot(root: string): string;
