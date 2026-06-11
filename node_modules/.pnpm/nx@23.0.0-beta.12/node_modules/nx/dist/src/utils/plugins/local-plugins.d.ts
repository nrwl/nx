import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectsConfigurations } from '../../config/workspace-json-project-json';
import { PluginCapabilities } from './plugin-capabilities';
export declare function getLocalWorkspacePlugins(projectsConfiguration: ProjectsConfigurations, nxJson: NxJsonConfiguration): Promise<Map<string, PluginCapabilities>>;
