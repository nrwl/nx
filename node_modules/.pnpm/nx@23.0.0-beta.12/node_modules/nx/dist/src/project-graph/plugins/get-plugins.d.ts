import { NxJsonConfiguration } from '../../config/nx-json';
import type { LoadedNxPlugin } from './loaded-nx-plugin';
export interface SeparatedPlugins {
    specifiedPlugins: LoadedNxPlugin[];
    defaultPlugins: LoadedNxPlugin[];
}
/**
 * Returns all plugins (specified + default) as a flat list.
 * Specified plugins come first, followed by default plugins.
 */
export declare function getPlugins(nxJson: NxJsonConfiguration, root?: string): Promise<LoadedNxPlugin[]>;
/**
 * Returns specified plugins (from nx.json) and default plugins (project.json,
 * package.json, etc.) as separate arrays. This separation is needed for
 * two-phase project configuration processing where target defaults are
 * applied between specified and default plugin results.
 *
 * `nxJson` is required so callers control the snapshot of nx.json the plugin
 * loader uses. This matters for the daemon's freshness-gated recompute, where
 * the snap hash and the plugin set must reflect the same disk state.
 */
export declare function getPluginsSeparated(nxJson: NxJsonConfiguration, root?: string): Promise<SeparatedPlugins>;
export declare function getOnlyDefaultPlugins(root?: string): Promise<LoadedNxPlugin[]>;
export declare function cleanupPlugins(): void;
export declare function reasonToError(reason: unknown): Error;
