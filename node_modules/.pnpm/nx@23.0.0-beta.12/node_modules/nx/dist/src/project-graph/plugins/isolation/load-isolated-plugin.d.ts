import { PluginConfiguration } from '../../../config/nx-json';
import type { LoadedNxPlugin } from '../loaded-nx-plugin';
export declare function loadIsolatedNxPlugin(plugin: PluginConfiguration, root: string, index?: number): Promise<[Promise<LoadedNxPlugin>, () => void]>;
