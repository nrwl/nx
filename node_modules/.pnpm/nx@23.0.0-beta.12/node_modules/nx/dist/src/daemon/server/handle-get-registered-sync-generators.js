"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetRegisteredSyncGenerators = handleGetRegisteredSyncGenerators;
const sync_generators_1 = require("./sync-generators");
async function handleGetRegisteredSyncGenerators() {
    const syncGenerators = await (0, sync_generators_1.getCachedRegisteredSyncGenerators)();
    return {
        response: syncGenerators,
        description: 'handleGetSyncGeneratorChanges',
    };
}
