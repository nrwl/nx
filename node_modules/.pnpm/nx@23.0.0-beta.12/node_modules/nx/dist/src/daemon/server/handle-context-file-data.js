"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleContextFileData = handleContextFileData;
const workspace_context_1 = require("../../utils/workspace-context");
const workspace_root_1 = require("../../utils/workspace-root");
async function handleContextFileData() {
    const files = await (0, workspace_context_1.getAllFileDataInContext)(workspace_root_1.workspaceRoot);
    return {
        response: files,
        description: 'handleContextFileData',
    };
}
