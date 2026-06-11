"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findWorkspaceRoot = findWorkspaceRoot;
const workspace_root_1 = require("./workspace-root");
/**
 * Recursive function that walks back up the directory
 * tree to try and find a workspace file.
 *
 * @param dir Directory to start searching with
 */
function findWorkspaceRoot(dir) {
    const r = (0, workspace_root_1.workspaceRootInner)(dir, null);
    if (r === null)
        return null;
    if (isAngularCliInstalled(r)) {
        return { type: 'angular', dir: r };
    }
    else {
        return { type: 'nx', dir: r };
    }
}
function isAngularCliInstalled(root) {
    try {
        // nx-ignore-next-line
        require.resolve('@angular/cli', {
            paths: [root],
        });
        return true;
    }
    catch {
        return false;
    }
}
