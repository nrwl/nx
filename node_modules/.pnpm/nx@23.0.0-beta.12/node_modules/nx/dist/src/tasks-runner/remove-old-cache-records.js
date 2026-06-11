"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const WEEK_IN_MS = 1000 * 60 * 60 * 24 * 7;
const folder = process.argv[2];
removeOld(terminalOutputs());
removeOld(cachedFiles());
function terminalOutputs() {
    try {
        return (0, fs_1.readdirSync)((0, path_1.join)(folder, 'terminalOutputs')).map((f) => (0, path_1.join)(folder, 'terminalOutputs', f));
    }
    catch (e) {
        return [];
    }
}
function cachedFiles() {
    try {
        return (0, fs_1.readdirSync)(folder)
            .filter((f) => !f.endsWith('terminalOutputs'))
            .map((f) => (0, path_1.join)(folder, f));
    }
    catch (e) {
        return [];
    }
}
function removeOld(records) {
    try {
        const time = mostRecentMTime(records);
        records.forEach((r) => {
            try {
                const s = (0, fs_1.statSync)(r);
                if (time - s.mtimeMs > WEEK_IN_MS) {
                    if (s.isDirectory()) {
                        try {
                            (0, fs_1.rmSync)(`${r}.commit`, { recursive: true, force: true });
                        }
                        catch (e) { }
                    }
                    (0, fs_1.rmSync)(r, { recursive: true, force: true });
                }
            }
            catch (e) { }
        });
    }
    catch (e) { }
}
function mostRecentMTime(records) {
    let mostRecentTime = 0;
    records.forEach((r) => {
        try {
            const s = (0, fs_1.statSync)(r);
            if (s.mtimeMs > mostRecentTime) {
                mostRecentTime = s.mtimeMs;
            }
        }
        catch (e) { }
    });
    return mostRecentTime;
}
