import type { NxJsonConfiguration } from './nx-json';
import { ProjectConfiguration, ProjectsConfigurations } from './workspace-json-project-json';
export declare function calculateDefaultProjectName(cwd: string, root: string, { projects }: ProjectsConfigurations, nxJson: NxJsonConfiguration): string;
export declare function findMatchingProjectInCwd(projects: Record<string, ProjectConfiguration>, relativeCwd: string): string | undefined;
