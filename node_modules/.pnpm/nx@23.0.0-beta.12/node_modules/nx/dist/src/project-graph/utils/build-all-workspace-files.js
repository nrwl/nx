"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAllWorkspaceFiles = buildAllWorkspaceFiles;
const perf_hooks_1 = require("perf_hooks");
function buildAllWorkspaceFiles(projectFileMap, globalFiles) {
    perf_hooks_1.performance.mark('get-all-workspace-files:start');
    let fileData = Object.values(projectFileMap).flat();
    fileData = fileData
        .concat(globalFiles)
        .sort((a, b) => a.file.localeCompare(b.file));
    perf_hooks_1.performance.mark('get-all-workspace-files:end');
    perf_hooks_1.performance.measure('get-all-workspace-files', 'get-all-workspace-files:start', 'get-all-workspace-files:end');
    return fileData;
}
