"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugLog = debugLog;
function debugLog(...args) {
    if (process.env['NX_VERBOSE_LOGGING'] === 'true') {
        console.log('[NX CLOUD]', ...args);
    }
}
