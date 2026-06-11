"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRegister = handleRegister;
const workspace_root_1 = require("../../utils/workspace-root");
const require_nx_key_1 = require("../../utils/require-nx-key");
async function handleRegister(options) {
    const nxKey = await (0, require_nx_key_1.requireNxKey)();
    return nxKey.registerNxKey(workspace_root_1.workspaceRoot, options.key);
}
