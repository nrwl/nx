"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceRoot = void 0;
exports.setWorkspaceRoot = setWorkspaceRoot;
exports.workspaceRootInner = workspaceRootInner;
const tslib_1 = require("tslib");
const path = tslib_1.__importStar(require("path"));
const fileutils_1 = require("./fileutils");
/**
 * The root of the workspace
 */
exports.workspaceRoot = workspaceRootInner(process.cwd(), process.cwd());
// Required for integration tests in projects which depend on Nx at runtime, such as lerna and angular-eslint
function setWorkspaceRoot(root) {
    exports.workspaceRoot = root;
}
function workspaceRootInner(dir, candidateRoot) {
    if (process.env.NX_WORKSPACE_ROOT_PATH)
        return process.env.NX_WORKSPACE_ROOT_PATH;
    if (path.dirname(dir) === dir)
        return candidateRoot;
    const matches = [
        path.join(dir, 'nx.json'),
        path.join(dir, 'nx'),
        path.join(dir, 'nx.bat'),
    ];
    if (matches.some((x) => (0, fileutils_1.fileExists)(x))) {
        return dir;
        // This handles the case where we have a workspace which uses npm / yarn / pnpm
        // workspaces, and has a project which contains Nx in its dependency tree.
        // e.g. packages/my-lib/package.json contains @nx/devkit, which references Nx and is
        // thus located in //packages/my-lib/node_modules/nx/package.json
    }
    else if ((0, fileutils_1.fileExists)(path.join(dir, 'node_modules', 'nx', 'package.json'))) {
        return workspaceRootInner(path.dirname(dir), dir);
    }
    else {
        return workspaceRootInner(path.dirname(dir), candidateRoot);
    }
}
