"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleForceShutdown = handleForceShutdown;
const shutdown_utils_1 = require("./shutdown-utils");
const server_1 = require("./server");
async function handleForceShutdown(server) {
    setTimeout(async () => {
        await (0, shutdown_utils_1.handleServerProcessTermination)({
            server,
            reason: 'Request to shutdown',
            sockets: server_1.openSockets,
        });
    });
    return {
        description: 'Shutdown initiated',
        response: '{}',
    };
}
