"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveChangelogRenderer = resolveChangelogRenderer;
const register_1 = require("../../../plugins/js/utils/register");
const typescript_1 = require("../../../plugins/js/utils/typescript");
const utils_1 = require("../../../tasks-runner/utils");
const workspace_root_1 = require("../../../utils/workspace-root");
function resolveChangelogRenderer(changelogRendererPathOrImplementation) {
    // An implementation was provided directly via the programmatic API
    if (typeof changelogRendererPathOrImplementation === 'function') {
        return changelogRendererPathOrImplementation;
    }
    const interpolatedChangelogRendererPath = (0, utils_1.interpolate)(changelogRendererPathOrImplementation, {
        workspaceRoot: workspace_root_1.workspaceRoot,
    });
    // Try and load the provided (or default) changelog renderer
    let ChangelogRendererClass;
    let cleanupTranspiler = () => { };
    try {
        const rootTsconfigPath = (0, typescript_1.getRootTsConfigPath)();
        if (rootTsconfigPath) {
            cleanupTranspiler = (0, register_1.registerTsProject)(rootTsconfigPath);
        }
        const r = require(interpolatedChangelogRendererPath);
        ChangelogRendererClass = r.default || r;
    }
    catch (err) {
        throw err;
    }
    finally {
        cleanupTranspiler();
    }
    return ChangelogRendererClass;
}
