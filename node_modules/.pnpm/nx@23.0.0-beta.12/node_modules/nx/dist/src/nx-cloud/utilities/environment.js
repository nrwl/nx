"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NX_CLOUD_NO_TIMEOUTS = exports.ACCESS_TOKEN = exports.UNLIMITED_TIMEOUT = void 0;
const tslib_1 = require("tslib");
const dotenv = tslib_1.__importStar(require("dotenv"));
const fs_1 = require("fs");
const path_1 = require("path");
const is_ci_1 = require("../../utils/is-ci");
const workspace_root_1 = require("../../utils/workspace-root");
// Set once
exports.UNLIMITED_TIMEOUT = 9999999;
process.env.NX_CLOUD_AGENT_TIMEOUT_MS
    ? Number(process.env.NX_CLOUD_AGENT_TIMEOUT_MS)
    : 3600000;
// 60 minutes
process.env.NX_CLOUD_ORCHESTRATOR_TIMEOUT_MS
    ? Number(process.env.NX_CLOUD_ORCHESTRATOR_TIMEOUT_MS)
    : 3600000;
// 60 minutes
process.env.NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT
    ? Number(process.env.NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT)
    : null;
process.env.NX_CLOUD_NUMBER_OF_RETRIES
    ? Number(process.env.NX_CLOUD_NUMBER_OF_RETRIES)
    : (0, is_ci_1.isCI)()
        ? 10
        : 1;
loadEnvVars();
function parseEnv() {
    try {
        const envContents = (0, fs_1.readFileSync)((0, path_1.join)(workspace_root_1.workspaceRoot, 'nx-cloud.env'));
        return dotenv.parse(envContents);
    }
    catch (e) {
        return {};
    }
}
function loadEnvVars() {
    const parsed = parseEnv();
    exports.ACCESS_TOKEN =
        process.env.NX_CLOUD_AUTH_TOKEN ||
            process.env.NX_CLOUD_ACCESS_TOKEN ||
            parsed.NX_CLOUD_AUTH_TOKEN ||
            parsed.NX_CLOUD_ACCESS_TOKEN;
    exports.NX_CLOUD_NO_TIMEOUTS =
        process.env.NX_CLOUD_NO_TIMEOUTS === 'true' ||
            parsed.NX_CLOUD_NO_TIMEOUTS === 'true';
}
