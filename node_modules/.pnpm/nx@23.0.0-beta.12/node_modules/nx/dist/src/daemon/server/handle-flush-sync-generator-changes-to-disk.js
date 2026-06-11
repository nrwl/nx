"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFlushSyncGeneratorChangesToDisk = handleFlushSyncGeneratorChangesToDisk;
const sync_generators_1 = require("./sync-generators");
async function handleFlushSyncGeneratorChangesToDisk(generators) {
    const result = await (0, sync_generators_1.flushSyncGeneratorChangesToDisk)(generators);
    return {
        response: result,
        description: 'handleFlushSyncGeneratorChangesToDisk',
    };
}
