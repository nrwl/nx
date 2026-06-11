"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetFilesInDirectory = handleGetFilesInDirectory;
const workspace_context_1 = require("../../utils/workspace-context");
const workspace_root_1 = require("../../utils/workspace-root");
async function handleGetFilesInDirectory(dir) {
    const files = await (0, workspace_context_1.getFilesInDirectoryUsingContext)(workspace_root_1.workspaceRoot, dir);
    return {
        response: files,
        description: 'handleNxWorkspaceFiles',
    };
}
