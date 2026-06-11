"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleProcessInBackground = handleProcessInBackground;
const logger_1 = require("../logger");
const installation_directory_1 = require("../../utils/installation-directory");
async function handleProcessInBackground(payload) {
    let fn;
    try {
        fn = require(require.resolve(payload.requirePath, {
            paths: (0, installation_directory_1.getNxRequirePaths)(),
        })).default;
    }
    catch (e) {
        return {
            description: `Unable to require ${payload.requirePath}`,
            error: new Error(`Unable to require ${payload.requirePath}`),
        };
    }
    try {
        const response = await fn(payload.data, logger_1.serverLogger);
        return {
            response,
            description: payload.type,
        };
    }
    catch (e) {
        return {
            description: `Error when processing ${payload.type}.`,
            error: e,
        };
    }
}
