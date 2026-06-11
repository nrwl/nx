"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasNxJsPlugin = hasNxJsPlugin;
const installation_directory_1 = require("./installation-directory");
/**
 * Checks if `@nx/js` is installed by attempting to resolve its `package.json`.
 *
 * Lives in its own module so unit tests can `jest.doMock` it without having to
 * intercept Node's resolver at the global level. The previous in-`package-json`
 * definition was unreachable to mocks because callers in the same module
 * referenced it via the local lexical binding rather than `module.exports`.
 */
function hasNxJsPlugin(projectRoot, workspaceRoot) {
    try {
        // nx-ignore-next-line
        require.resolve('@nx/js/package.json', {
            paths: [projectRoot, ...(0, installation_directory_1.getNxRequirePaths)(workspaceRoot), __dirname],
        });
        return true;
    }
    catch {
        return false;
    }
}
