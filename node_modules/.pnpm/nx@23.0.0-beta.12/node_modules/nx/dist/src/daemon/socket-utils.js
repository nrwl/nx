"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPluginOsSocketPath = exports.getForkedProcessOsSocketPath = exports.getFullOsSocketPath = exports.isWindows = void 0;
exports.killSocketOrPath = killSocketOrPath;
exports.serializeResult = serializeResult;
exports.serialize = serialize;
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const tmp_dir_1 = require("./tmp-dir");
const serializable_error_1 = require("../utils/serializable-error");
const is_v8_serializer_enabled_1 = require("./is-v8-serializer-enabled");
const v8_1 = require("v8");
exports.isWindows = (0, os_1.platform)() === 'win32';
/**
 * For IPC with the daemon server we use unix sockets or windows named pipes, depending on the user's operating system.
 *
 * See https://nodejs.org/dist/latest-v14.x/docs/api/net.html#net_identifying_paths_for_ipc_connections for a full breakdown
 * of OS differences between Unix domain sockets and named pipes.
 */
const getFullOsSocketPath = () => {
    const path = (0, path_1.resolve)((0, tmp_dir_1.getDaemonSocketDir)());
    assertValidSocketPath(path);
    return exports.isWindows ? '\\\\.\\pipe\\nx\\' + path : path;
};
exports.getFullOsSocketPath = getFullOsSocketPath;
const getForkedProcessOsSocketPath = (id) => {
    let path = (0, path_1.resolve)((0, path_1.join)((0, tmp_dir_1.getSocketDir)(), 'fp' + id + '.sock'));
    assertValidSocketPath(path);
    return exports.isWindows ? '\\\\.\\pipe\\nx\\' + path : path;
};
exports.getForkedProcessOsSocketPath = getForkedProcessOsSocketPath;
const getPluginOsSocketPath = (id) => {
    let path = (0, path_1.resolve)((0, path_1.join)((0, tmp_dir_1.getSocketDir)(true), 'plugin' + id + '.sock'));
    assertValidSocketPath(path);
    return exports.isWindows ? '\\\\.\\pipe\\nx\\' + path : path;
};
exports.getPluginOsSocketPath = getPluginOsSocketPath;
function assertValidSocketPath(path) {
    if (path.length > 95) {
        throw new Error([
            'Attempted to open socket that exceeds the maximum socket length.',
            '',
            `Set NX_SOCKET_DIR to a shorter path (e.g. ${exports.isWindows ? '%TMP%/nx-tmp' : '/tmp/nx-tmp'}) to avoid this issue.`,
        ].join('\n'));
    }
}
function killSocketOrPath() {
    try {
        (0, fs_1.unlinkSync)((0, exports.getFullOsSocketPath)());
    }
    catch { }
}
// Prepare a serialized project graph result for sending over IPC from the server to the client
function serializeResult(error, serializedProjectGraph, serializedSourceMaps) {
    // We do not want to repeat work `JSON.stringify`ing an object containing the potentially large project graph so merge as strings
    return `{ "error": ${JSON.stringify(error ? (0, serializable_error_1.createSerializableError)(error) : error)}, "projectGraph": ${serializedProjectGraph}, "sourceMaps": ${serializedSourceMaps} }`;
}
/**
 * Helper to serialize data either using v8 serialization or JSON serialization, based on
 * the user's preference and the success of each method. Should only be used by "client" side
 * connections, daemon or other servers should respond based on the type of serialization used
 * by the client it is communicating with.
 *
 * @param data Data to serialize
 * @param force Forces one serialization method over the other
 * @returns Serialized data as a string
 */
function serialize(data, force) {
    if (force === 'v8' || (0, is_v8_serializer_enabled_1.isV8SerializerEnabled)()) {
        try {
            return (0, v8_1.serialize)(data).toString('binary');
        }
        catch (e) {
            if (force !== 'v8') {
                console.warn(`Data could not be serialized using v8 serialization: ${e}. Falling back to JSON serialization.`);
                // Fall back to JSON serialization
                return JSON.stringify(data);
            }
            throw e;
        }
    }
    else {
        try {
            return JSON.stringify(data);
        }
        catch (e) {
            if (force !== 'json') {
                // Fall back to v8 serialization
                console.warn(`Data could not be serialized using JSON.stringify: ${e}. Falling back to v8 serialization.`);
                return (0, v8_1.serialize)(data).toString('binary');
            }
            throw e;
        }
    }
}
