import { NxJsonConfiguration } from '../../../config/nx-json';
import { ProjectConfiguration, TargetConfiguration } from '../../../config/workspace-json-project-json';
import type { ConfigurationSourceMaps } from './source-maps';
export declare function validateProject(project: ProjectConfiguration, knownProjects: Record<string, ProjectConfiguration>): void;
/**
 * Expand's `command` syntactic sugar, replaces tokens in options, and adds information from executor schema.
 * @param target The target to normalize
 * @param project The project that the target belongs to
 * @returns The normalized target configuration
 */
export declare function normalizeTarget(target: TargetConfiguration, project: ProjectConfiguration, workspaceRoot: string, projectsMap: Record<string, ProjectConfiguration>, errorMsgKey: string): TargetConfiguration<any>;
export declare function validateAndNormalizeProjectRootMap(workspaceRoot: string, projectRootMap: Record<string, ProjectConfiguration>, nxJsonConfiguration: NxJsonConfiguration, sourceMaps?: ConfigurationSourceMaps): Record<string, ProjectConfiguration>;
