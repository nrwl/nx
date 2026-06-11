"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNodesFromFiles = createNodesFromFiles;
const error_types_1 = require("../error-types");
async function createNodesFromFiles(createNodes, configFiles, options, context) {
    const results = [];
    const errors = [];
    await Promise.all(configFiles.map(async (file, idx) => {
        try {
            const value = await createNodes(file, options, {
                ...context,
                configFiles,
            }, idx);
            if (value) {
                results.push([file, value]);
            }
        }
        catch (e) {
            errors.push([file, e]);
        }
    }));
    if (errors.length > 0) {
        throw new error_types_1.AggregateCreateNodesError(errors, results);
    }
    return results;
}
