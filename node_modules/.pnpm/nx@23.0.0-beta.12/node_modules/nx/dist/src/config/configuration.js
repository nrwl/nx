"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readNxJson = void 0;
exports.workspaceLayout = workspaceLayout;
const nx_json_1 = require("./nx-json");
/**
 * Returns information about where apps and libs will be created.
 */
function workspaceLayout() {
    const nxJson = (0, nx_json_1.readNxJson)();
    return {
        appsDir: nxJson.workspaceLayout?.appsDir ?? 'apps',
        libsDir: nxJson.workspaceLayout?.libsDir ?? 'libs',
    };
}
var nx_json_2 = require("./nx-json");
Object.defineProperty(exports, "readNxJson", { enumerable: true, get: function () { return nx_json_2.readNxJson; } });
