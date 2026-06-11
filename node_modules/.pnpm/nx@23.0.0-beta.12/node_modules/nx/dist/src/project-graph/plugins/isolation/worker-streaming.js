"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPluginWorkerHostSocket = setPluginWorkerHostSocket;
exports.emitPluginWorkerLog = emitPluginWorkerLog;
const messaging_1 = require("./messaging");
// Plugin workers talk to their host process over a single socket that
// is established when the host connects. Plugin code running anywhere
// in the worker process needs a way to emit log lines without having
// that socket threaded through every call frame, so we stash a
// module-level reference here when the host connects.
let hostSocket = null;
function setPluginWorkerHostSocket(socket) {
    hostSocket = socket;
    socket.once('close', () => {
        if (hostSocket === socket)
            hostSocket = null;
    });
}
/**
 * Emits a log line from the plugin worker up to its host. The host
 * decides where it ends up (direct stdout/stderr when running under the
 * CLI, forwarded to the active daemon client when running under the
 * daemon).
 *
 * When plugin isolation is turned off, or this is otherwise called
 * outside of a connected plugin worker, the message is written
 * directly to stdout/stderr so the log line isn't silently dropped.
 */
function emitPluginWorkerLog(level, message) {
    if (!hostSocket) {
        console[level](message);
        return;
    }
    (0, messaging_1.sendMessageOverSocket)(hostSocket, {
        type: 'emitLog',
        level,
        message,
    });
}
