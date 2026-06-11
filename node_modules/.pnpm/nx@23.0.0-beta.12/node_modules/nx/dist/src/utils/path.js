"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePath = normalizePath;
exports.joinPathFragments = joinPathFragments;
exports.getCwd = getCwd;
const tslib_1 = require("tslib");
const path = tslib_1.__importStar(require("path"));
const workspace_root_1 = require("./workspace-root");
function removeWindowsDriveLetter(osSpecificPath) {
    return osSpecificPath.replace(/^[a-zA-Z]:/, '');
}
/**
 * Coverts an os specific path to a unix style path. Use this when writing paths to config files.
 * This should not be used to read files on disk because of the removal of Windows drive letters.
 */
function normalizePath(osSpecificPath) {
    return removeWindowsDriveLetter(osSpecificPath).split('\\').join('/');
}
/**
 * Normalized path fragments and joins them. Use this when writing paths to config files.
 * This should not be used to read files on disk because of the removal of Windows drive letters.
 */
function joinPathFragments(...fragments) {
    return normalizePath(path.join(...fragments));
}
/**
 * When running a script with the package manager (e.g. `npm run`), the package manager will
 * traverse the directory tree upwards until it finds a `package.json` and will set `process.cwd()`
 * to the folder where it found it. The actual working directory is stored in the INIT_CWD
 * environment variable (see here: https://docs.npmjs.com/cli/v9/commands/npm-run-script#description).
 *
 * @returns The path to the current working directory.
 */
function getCwd() {
    return process.env.INIT_CWD?.startsWith(workspace_root_1.workspaceRoot)
        ? process.env.INIT_CWD
        : process.cwd();
}
