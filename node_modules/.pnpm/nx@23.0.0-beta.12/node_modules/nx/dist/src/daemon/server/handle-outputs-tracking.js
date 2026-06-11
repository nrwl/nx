"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRecordOutputsHashBatch = handleRecordOutputsHashBatch;
exports.handleOutputsHashesMatchBatch = handleOutputsHashesMatchBatch;
const outputs_tracking_1 = require("./outputs-tracking");
async function handleRecordOutputsHashBatch(payload) {
    try {
        (0, outputs_tracking_1.recordOutputsHashBatch)(payload.data);
        return {
            description: 'recordOutputsHashBatch',
            response: '{}',
        };
    }
    catch (e) {
        return {
            description: 'recordOutputsHashBatch failed',
            error: new Error(`Critical error when recording metadata about outputs: '${e.message}'.`),
        };
    }
}
async function handleOutputsHashesMatchBatch(payload) {
    try {
        const results = (0, outputs_tracking_1.outputsHashesMatchBatch)(payload.data);
        return {
            response: results,
            description: 'outputsHashesMatchBatch',
        };
    }
    catch (e) {
        return {
            description: 'outputsHashesMatchBatch failed',
            error: new Error(`Critical error when verifying the contents of the outputs haven't changed: '${e.message}'.`),
        };
    }
}
