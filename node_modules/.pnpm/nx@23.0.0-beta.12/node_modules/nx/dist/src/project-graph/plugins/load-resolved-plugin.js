"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadResolvedNxPluginAsync = loadResolvedNxPluginAsync;
const loaded_nx_plugin_1 = require("./loaded-nx-plugin");
const handle_import_1 = require("../../utils/handle-import");
async function loadResolvedNxPluginAsync(pluginConfiguration, pluginPath, name, index) {
    // This needs to be spread to create an extensible object.
    const plugin = { ...(await importPluginModule(pluginPath)) };
    plugin.name ??= name;
    return new loaded_nx_plugin_1.LoadedNxPlugin(plugin, pluginConfiguration, index);
}
async function importPluginModule(pluginPath) {
    const m = await (0, handle_import_1.handleImport)(pluginPath);
    if (m.default &&
        ('createNodes' in m.default ||
            'createNodesV2' in m.default ||
            'createDependencies' in m.default ||
            'createMetadata' in m.default ||
            'preTasksExecution' in m.default ||
            'postTasksExecution' in m.default)) {
        return m.default;
    }
    return m;
}
