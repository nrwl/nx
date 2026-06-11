import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { PackageJson } from '../package-json';
import { PluginCapabilities } from './plugin-capabilities';
export declare function findInstalledPlugins(): PackageJson[];
export declare function getInstalledPluginsAndCapabilities(workspaceRoot: string, projects: Record<string, ProjectConfiguration>): Promise<Map<string, PluginCapabilities>>;
