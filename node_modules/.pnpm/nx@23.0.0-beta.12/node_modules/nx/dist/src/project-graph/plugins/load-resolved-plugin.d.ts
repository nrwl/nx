import type { PluginConfiguration } from '../../config/nx-json';
import { LoadedNxPlugin } from './loaded-nx-plugin';
export declare function loadResolvedNxPluginAsync(pluginConfiguration: PluginConfiguration, pluginPath: string, name: string, index?: number): Promise<LoadedNxPlugin>;
