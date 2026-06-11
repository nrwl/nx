"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskHistoryFile = void 0;
exports.getHistoryForHashes = getHistoryForHashes;
exports.writeTaskRunsToHistory = writeTaskRunsToHistory;
const fs_1 = require("fs");
const path_1 = require("path");
const cache_directory_1 = require("./cache-directory");
const taskRunKeys = [
    'project',
    'target',
    'configuration',
    'hash',
    'code',
    'status',
    'start',
    'end',
];
let taskHistory = undefined;
let taskHashToIndicesMap = new Map();
async function getHistoryForHashes(hashes) {
    if (taskHistory === undefined) {
        loadTaskHistoryFromDisk();
    }
    const result = {};
    for (let hash of hashes) {
        const indices = taskHashToIndicesMap.get(hash);
        if (!indices) {
            result[hash] = [];
        }
        else {
            result[hash] = indices.map((index) => taskHistory[index]);
        }
    }
    return result;
}
async function writeTaskRunsToHistory(taskRuns) {
    if (taskHistory === undefined) {
        loadTaskHistoryFromDisk();
    }
    const serializedLines = [];
    for (let taskRun of taskRuns) {
        const serializedLine = taskRunKeys.map((key) => taskRun[key]).join(',');
        serializedLines.push(serializedLine);
        recordTaskRunInMemory(taskRun);
    }
    if (!(0, fs_1.existsSync)(exports.taskHistoryFile)) {
        (0, fs_1.writeFileSync)(exports.taskHistoryFile, `${taskRunKeys.join(',')}\n`);
    }
    (0, fs_1.appendFileSync)(exports.taskHistoryFile, serializedLines.join('\n') + '\n');
}
exports.taskHistoryFile = (0, path_1.join)(cache_directory_1.workspaceDataDirectory, 'task-history.csv');
function loadTaskHistoryFromDisk() {
    taskHashToIndicesMap.clear();
    taskHistory = [];
    if (!(0, fs_1.existsSync)(exports.taskHistoryFile)) {
        return;
    }
    const fileContent = (0, fs_1.readFileSync)(exports.taskHistoryFile, 'utf8');
    if (!fileContent) {
        return;
    }
    const lines = fileContent.split('\n');
    // if there are no lines or just the header, return
    if (lines.length <= 1) {
        return;
    }
    const contentLines = lines.slice(1).filter((l) => l.trim() !== '');
    // read the values from csv format where each header is a key and the value is the value
    for (let line of contentLines) {
        const values = line.trim().split(',');
        const run = {};
        taskRunKeys.forEach((header, index) => {
            run[header] = values[index];
        });
        recordTaskRunInMemory(run);
    }
}
function recordTaskRunInMemory(taskRun) {
    const index = taskHistory.push(taskRun) - 1;
    if (taskHashToIndicesMap.has(taskRun.hash)) {
        taskHashToIndicesMap.get(taskRun.hash).push(index);
    }
    else {
        taskHashToIndicesMap.set(taskRun.hash, [index]);
    }
}
