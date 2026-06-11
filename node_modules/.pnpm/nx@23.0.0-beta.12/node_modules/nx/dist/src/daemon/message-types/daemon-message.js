"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDaemonMessage = isDaemonMessage;
function isDaemonMessage(msg) {
    return typeof msg === 'object' && msg && 'type' in msg;
}
