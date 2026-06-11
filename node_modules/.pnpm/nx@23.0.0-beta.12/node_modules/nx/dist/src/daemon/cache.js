"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverProcessJsonPath = void 0;
exports.readDaemonProcessJsonCache = readDaemonProcessJsonCache;
exports.deleteDaemonJsonProcessCache = deleteDaemonJsonProcessCache;
exports.writeDaemonJsonProcessCache = writeDaemonJsonProcessCache;
exports.getDaemonProcessIdSync = getDaemonProcessIdSync;
const node_fs_1 = require("node:fs");
const path_1 = require("path");
const tmp_dir_1 = require("./tmp-dir");
const fileutils_1 = require("../utils/fileutils");
const versions_1 = require("../utils/versions");
const logger_1 = require("./logger");
const daemon_socket_messenger_1 = require("./client/daemon-socket-messenger");
exports.serverProcessJsonPath = (0, path_1.join)(tmp_dir_1.DAEMON_DIR_FOR_CURRENT_WORKSPACE, 'server-process.json');
function readDaemonProcessJsonCache() {
    try {
        const daemonJson = (0, fileutils_1.readJsonFile)(exports.serverProcessJsonPath);
        // If the daemon version doesn't match the client version, throw error
        if (daemonJson.nxVersion !== versions_1.nxVersion) {
            logger_1.clientLogger.log(`[Cache] Version mismatch: daemon=${daemonJson.nxVersion}, client=${versions_1.nxVersion}`);
            throw new daemon_socket_messenger_1.VersionMismatchError();
        }
        return daemonJson;
    }
    catch (e) {
        if (e instanceof daemon_socket_messenger_1.VersionMismatchError) {
            throw e; // Let version mismatch bubble up
        }
        return null;
    }
}
function deleteDaemonJsonProcessCache() {
    try {
        if (getDaemonProcessIdSync() === process.pid) {
            (0, node_fs_1.unlinkSync)(exports.serverProcessJsonPath);
        }
    }
    catch { }
}
async function writeDaemonJsonProcessCache(daemonJson) {
    await (0, fileutils_1.writeJsonFileAsync)(exports.serverProcessJsonPath, daemonJson, {
        appendNewLine: true,
    });
}
// Must be sync for the help output use case
function getDaemonProcessIdSync() {
    if (!(0, node_fs_1.existsSync)(exports.serverProcessJsonPath)) {
        return null;
    }
    try {
        const daemonProcessJson = (0, fileutils_1.readJsonFile)(exports.serverProcessJsonPath);
        return daemonProcessJson.processId;
    }
    catch {
        return null;
    }
}
