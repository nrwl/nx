"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchEditor = launchEditor;
const node_child_process_1 = require("node:child_process");
async function launchEditor(filePath) {
    // Inspired by what git does
    const editorCommand = process.env.GIT_EDITOR ||
        getGitConfig('core.editor') ||
        process.env.VISUAL ||
        process.env.EDITOR ||
        'vi';
    const { cmd, args } = parseCommand(editorCommand);
    return new Promise((resolve, reject) => {
        const editorProcess = (0, node_child_process_1.spawn)(cmd, [...args, filePath], {
            stdio: 'inherit', // This will ensure the editor uses the current terminal
            windowsHide: true,
        });
        editorProcess.on('exit', (code) => {
            if (code === 0) {
                resolve(undefined);
            }
            else {
                reject(new Error(`Editor process exited with code ${code}`));
            }
        });
    });
}
function getGitConfig(key) {
    try {
        return (0, node_child_process_1.execSync)(`git config --get ${key}`, {
            windowsHide: true,
        })
            .toString()
            .trim();
    }
    catch {
        return null;
    }
}
function parseCommand(commandString) {
    const parts = commandString.split(/\s+/);
    return {
        cmd: parts[0],
        args: parts.slice(1),
    };
}
