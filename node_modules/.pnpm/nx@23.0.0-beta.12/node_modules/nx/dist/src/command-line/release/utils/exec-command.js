"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execCommand = execCommand;
const node_child_process_1 = require("node:child_process");
async function execCommand(cmd, args, options) {
    return new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)(cmd, args, {
            ...options,
            stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
            encoding: 'utf-8',
            windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => {
            stdout += chunk;
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk;
        });
        child.on('error', (error) => {
            reject(error);
        });
        child.on('close', (code) => {
            if (code !== 0) {
                reject(stderr ||
                    `Unknown error occurred while running "${cmd} ${args.join(' ')}"`);
            }
            else {
                resolve(stdout);
            }
        });
    });
}
