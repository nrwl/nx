"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetSyncGeneratorChanges = handleGetSyncGeneratorChanges;
const sync_generators_1 = require("./sync-generators");
async function handleGetSyncGeneratorChanges(generators) {
    const changes = await (0, sync_generators_1.getCachedSyncGeneratorChanges)(generators);
    const result = changes.map((change) => 'error' in change
        ? change
        : // strip out the content of the changes and any potential callback
            {
                generatorName: change.generatorName,
                changes: change.changes.map((c) => ({ ...c, content: null })),
                outOfSyncMessage: change.outOfSyncMessage,
                outOfSyncDetails: change.outOfSyncDetails,
            });
    return {
        response: result,
        description: 'handleGetSyncGeneratorChanges',
    };
}
