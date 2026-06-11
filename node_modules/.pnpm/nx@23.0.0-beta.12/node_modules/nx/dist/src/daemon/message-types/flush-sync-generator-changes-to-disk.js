"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK = void 0;
exports.isHandleFlushSyncGeneratorChangesToDiskMessage = isHandleFlushSyncGeneratorChangesToDiskMessage;
exports.FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK = 'CLEAR_CACHED_SYNC_GENERATOR_CHANGES';
function isHandleFlushSyncGeneratorChangesToDiskMessage(message) {
    return (typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message['type'] === exports.FLUSH_SYNC_GENERATOR_CHANGES_TO_DISK);
}
