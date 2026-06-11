import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import type { Tree } from '../tree';
export { readNxJson, updateNxJson } from './nx-json';
/**
 * Adds project configuration to the Nx workspace.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @param projectConfiguration - project configuration
 * @param standalone - whether the project is configured in workspace.json or not
 */
export declare function addProjectConfiguration(tree: Tree, projectName: string, projectConfiguration: ProjectConfiguration, standalone?: boolean): void;
/**
 * Updates the configuration of an existing project.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @param projectConfiguration - project configuration
 */
export declare function updateProjectConfiguration(tree: Tree, projectName: string, projectConfiguration: ProjectConfiguration): void;
/**
 * Removes the configuration of an existing project.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 */
export declare function removeProjectConfiguration(tree: Tree, projectName: string): void;
/**
 * Reads a project configuration.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @throws If supplied projectName cannot be found
 */
export declare function readProjectConfiguration(tree: Tree, projectName: string): ProjectConfiguration;
/**
 * Get a map of all projects in a workspace.
 *
 * Use {@link readProjectConfiguration} if only one project is needed.
 */
export declare function getProjects(tree: Tree): Map<string, ProjectConfiguration>;
export declare function getRelativeProjectJsonSchemaPath(tree: Tree, project: ProjectConfiguration): string;
