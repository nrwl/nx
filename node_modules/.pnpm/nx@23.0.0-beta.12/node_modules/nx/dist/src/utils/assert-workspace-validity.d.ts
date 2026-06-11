import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { NxJsonConfiguration } from '../config/nx-json';
export declare function assertWorkspaceValidity(projects: Record<string, ProjectConfiguration>, nxJson: NxJsonConfiguration): void;
