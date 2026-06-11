"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unregisterPluginTSTranspiler = void 0;
exports.registerPluginTSTranspiler = registerPluginTSTranspiler;
exports.pluginTranspilerIsRegistered = pluginTranspilerIsRegistered;
exports.cleanupPluginTSTranspiler = cleanupPluginTSTranspiler;
const node_fs_1 = require("node:fs");
const posix_1 = require("node:path/posix");
const register_1 = require("../../plugins/js/utils/register");
const typescript_1 = require("../../plugins/js/utils/typescript");
const workspace_root_1 = require("../../utils/workspace-root");
exports.unregisterPluginTSTranspiler = null;
/**
 * Register swc-node or ts-node if they are not currently registered
 * with some default settings which work well for Nx plugins.
 */
function registerPluginTSTranspiler() {
    // Get the first tsconfig that matches the allowed set
    const tsConfigName = [
        (0, posix_1.join)(workspace_root_1.workspaceRoot, 'tsconfig.base.json'),
        (0, posix_1.join)(workspace_root_1.workspaceRoot, 'tsconfig.json'),
    ].find((x) => (0, node_fs_1.existsSync)(x));
    if (!tsConfigName) {
        return;
    }
    const tsConfig = tsConfigName
        ? (0, typescript_1.readTsConfigWithoutFiles)(tsConfigName)
        : {};
    const cleanupFns = [
        (0, register_1.registerTsConfigPaths)(tsConfigName),
        (0, register_1.registerTranspiler)({
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            ...tsConfig.options,
        }, tsConfig.raw),
    ];
    exports.unregisterPluginTSTranspiler = () => {
        cleanupFns.forEach((fn) => fn?.());
    };
}
function pluginTranspilerIsRegistered() {
    return exports.unregisterPluginTSTranspiler !== null;
}
function cleanupPluginTSTranspiler() {
    (0, exports.unregisterPluginTSTranspiler)?.();
    exports.unregisterPluginTSTranspiler = null;
}
