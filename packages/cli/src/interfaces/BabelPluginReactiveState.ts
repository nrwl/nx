import type { BabelPluginReactiveWatchCallInfo } from './BabelPluginReactiveWatchCallInfo.js';
import type { BabelPluginReactiveWatchInfo } from './BabelPluginReactiveWatchInfo.js';

export interface BabelPluginReactiveState
{
    filename?: string;
    needsPropertyImport?: boolean;
    reactiveProperties?: Set<string>;
    watchMethods?: BabelPluginReactiveWatchInfo[];
    watchCalls?: BabelPluginReactiveWatchCallInfo[];
    opts?: { production?: boolean };
}
