"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = require("path");
const pseudo_ipc_1 = require("./pseudo-ipc");
const exit_codes_1 = require("../utils/exit-codes");
const pseudoIPCPath = process.argv[2];
const forkId = process.argv[3];
const script = (0, path_1.join)(__dirname, '../../bin/run-executor.js');
let execArgv;
if (process.env['NX_PSEUDO_TERMINAL_EXEC_ARGV']) {
    execArgv = process.env['NX_PSEUDO_TERMINAL_EXEC_ARGV'].split('|');
    delete process.env['NX_PSEUDO_TERMINAL_EXEC_ARGV'];
}
const childProcess = (0, child_process_1.fork)(script, {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    env: process.env,
    execArgv,
});
const pseudoIPC = new pseudo_ipc_1.PseudoIPCClient(pseudoIPCPath);
pseudoIPC.onMessageFromParent(forkId, (message) => {
    childProcess.send(message);
}, () => {
    // IPC connection closed
    cleanup();
    process.exit(0);
}, () => {
    // IPC connection error
    cleanup();
    process.exit(0);
});
pseudoIPC.notifyChildIsReady(forkId);
process.on('message', (message) => {
    pseudoIPC.sendMessageToParent(message);
});
childProcess.on('exit', (code, signal) => {
    cleanup();
    if (code === null)
        code = (0, exit_codes_1.signalToCode)(signal);
    process.exit(code);
});
let isCleaningUp = false;
function cleanup() {
    if (isCleaningUp) {
        return;
    }
    isCleaningUp = true;
    // Kill child process if still running
    if (childProcess && !childProcess.killed) {
        childProcess.kill('SIGTERM');
    }
    // Close IPC connection
    try {
        pseudoIPC.close();
    }
    catch {
        // Ignore errors when closing, connection might already be broken
    }
}
// Terminate the child process when exiting
process.on('exit', () => {
    cleanup();
});
process.on('SIGINT', () => {
    cleanup();
    process.exit((0, exit_codes_1.signalToCode)('SIGINT'));
});
process.on('SIGTERM', () => {
    cleanup();
});
process.on('SIGHUP', () => {
    cleanup();
});
