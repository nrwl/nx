"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNxWorkspaceFiles = handleNxWorkspaceFiles;
const workspace_context_1 = require("../../utils/workspace-context");
const workspace_root_1 = require("../../utils/workspace-root");
async function handleNxWorkspaceFiles(projectRootMap) {
    const files = await (0, workspace_context_1.getNxWorkspaceFilesFromContext)(workspace_root_1.workspaceRoot, projectRootMap);
    return {
        response: files,
        description: 'handleNxWorkspaceFiles',
    };
}
