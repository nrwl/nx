"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registeredProjectGraphListenerSockets = void 0;
exports.removeRegisteredProjectGraphListenerSocket = removeRegisteredProjectGraphListenerSocket;
exports.hasRegisteredProjectGraphListenerSockets = hasRegisteredProjectGraphListenerSockets;
exports.notifyProjectGraphListenerSockets = notifyProjectGraphListenerSockets;
const server_1 = require("./server");
const is_v8_serializer_enabled_1 = require("../is-v8-serializer-enabled");
exports.registeredProjectGraphListenerSockets = [];
function removeRegisteredProjectGraphListenerSocket(socket) {
    exports.registeredProjectGraphListenerSockets =
        exports.registeredProjectGraphListenerSockets.filter((s) => s !== socket);
}
function hasRegisteredProjectGraphListenerSockets() {
    return exports.registeredProjectGraphListenerSockets.length > 0;
}
async function notifyProjectGraphListenerSockets(projectGraph, sourceMaps, error) {
    if (!hasRegisteredProjectGraphListenerSockets()) {
        return;
    }
    await Promise.all(exports.registeredProjectGraphListenerSockets.map((socket) => (0, server_1.handleResult)(socket, 'PROJECT_GRAPH_UPDATED', () => Promise.resolve({
        description: 'Project graph updated',
        response: { projectGraph, sourceMaps, error },
    }), (0, is_v8_serializer_enabled_1.isV8SerializerEnabled)() ? 'v8' : 'json')));
}
