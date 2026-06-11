"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOnDaemon = isOnDaemon;
function isOnDaemon() {
    return !!global.NX_DAEMON;
}
