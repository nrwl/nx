"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRequestShutdown = handleRequestShutdown;
const shutdown_utils_1 = require("./shutdown-utils");
const server_1 = require("./server");
async function handleRequestShutdown(server, numberOfConnections) {
    // 1 connection is the client asking to shut down
    if (numberOfConnections > 1) {
        return {
            description: `Unable to shutdown the daemon. ${numberOfConnections} connections are open.`,
            response: '{}',
        };
    }
    else {
        setTimeout(async () => {
            await (0, shutdown_utils_1.handleServerProcessTermination)({
                server,
                reason: 'Request to shutdown',
                sockets: server_1.openSockets,
            });
        }, 0);
        return {
            description: 'Shutdown initiated',
            response: '{}',
        };
    }
}
