"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deduceDefaultBase = deduceDefaultBase;
const child_process_1 = require("child_process");
function deduceDefaultBase() {
    const nxDefaultBase = 'main';
    try {
        return ((0, child_process_1.execSync)('git config --get init.defaultBranch', {
            windowsHide: true,
        })
            .toString()
            .trim() || nxDefaultBase);
    }
    catch {
        return nxDefaultBase;
    }
}
