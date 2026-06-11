"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadIsolatedNxPlugin = loadIsolatedNxPlugin;
const isolated_plugin_1 = require("./isolated-plugin");
const isolatedPluginCache = (global['isolatedPluginCache'] ??= new Map());
async function loadIsolatedNxPlugin(plugin, root, index) {
    const cacheKey = JSON.stringify({ plugin, root });
    if (isolatedPluginCache.has(cacheKey)) {
        return [isolatedPluginCache.get(cacheKey), () => { }];
    }
    const pluginPromise = isolated_plugin_1.IsolatedPlugin.load(plugin, root, index).catch((err) => {
        // Remove failed entries from cache so subsequent calls can retry
        isolatedPluginCache.delete(cacheKey);
        throw err;
    });
    isolatedPluginCache.set(cacheKey, pluginPromise);
    const cleanup = async () => {
        const instancePromise = isolatedPluginCache.get(cacheKey);
        isolatedPluginCache.delete(cacheKey);
        const instance = await instancePromise;
        instance?.shutdown();
    };
    return [pluginPromise, cleanup];
}
