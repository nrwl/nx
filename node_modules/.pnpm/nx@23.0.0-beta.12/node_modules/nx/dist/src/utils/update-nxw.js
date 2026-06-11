"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNxw = updateNxw;
const add_nx_scripts_1 = require("../command-line/init/implementation/dot-nx/add-nx-scripts");
const path_1 = require("../utils/path");
const fs_1 = require("fs");
function updateNxw(tree) {
    const wrapperPath = (0, path_1.normalizePath)((0, add_nx_scripts_1.nxWrapperPath)());
    if (tree.exists(wrapperPath)) {
        tree.write(wrapperPath, (0, add_nx_scripts_1.getNxWrapperContents)());
    }
    const bashScriptPath = 'nx';
    if (tree.exists(bashScriptPath) && tree.isFile(bashScriptPath)) {
        tree.write(bashScriptPath, (0, add_nx_scripts_1.getShellScriptContents)(), {
            mode: fs_1.constants.S_IXUSR | fs_1.constants.S_IRUSR | fs_1.constants.S_IWUSR,
        });
    }
    const batchScriptPath = 'nx.bat';
    if (tree.exists(batchScriptPath) && tree.isFile(batchScriptPath)) {
        tree.write(batchScriptPath, (0, add_nx_scripts_1.getBatchScriptContents)());
    }
}
