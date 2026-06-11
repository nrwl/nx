import { ProjectConfiguration } from '../src/config/workspace-json-project-json';
import { PluginCache } from '../src/utils/plugin-cache-utils';
export type PackageJsonConfigurationCache = PluginCache<ProjectConfiguration>;
export declare function readPackageJsonConfigurationCache(): PackageJsonConfigurationCache;
