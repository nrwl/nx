"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeChildProcessWithDirectOutput = exports.NodeChildProcessWithNonDirectOutput = void 0;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const fs_1 = require("fs");
const stream_1 = require("stream");
const tree_kill_1 = tslib_1.__importDefault(require("tree-kill"));
const exit_codes_1 = require("../../utils/exit-codes");
const output_prefix_1 = require("./output-prefix");
class NodeChildProcessWithNonDirectOutput {
    constructor(childProcess, { streamOutput, prefix }) {
        this.childProcess = childProcess;
        this.terminalOutputChunks = [];
        this.exitCallbacks = [];
        this.outputCallbacks = [];
        if (streamOutput) {
            if (process.env.NX_PREFIX_OUTPUT === 'true') {
                const color = (0, output_prefix_1.getColor)(prefix);
                const prefixText = `${prefix}:`;
                this.childProcess.stdout
                    .pipe(logClearLineToPrefixTransformer(pc.bold(color(prefixText)) + ' '))
                    .pipe((0, output_prefix_1.addPrefixTransformer)(pc.bold(color(prefixText))))
                    .pipe(process.stdout);
                this.childProcess.stderr
                    .pipe(logClearLineToPrefixTransformer(color(prefixText) + ' '))
                    .pipe((0, output_prefix_1.addPrefixTransformer)(color(prefixText)))
                    .pipe(process.stderr);
            }
            else {
                this.childProcess.stdout
                    .pipe((0, output_prefix_1.addPrefixTransformer)())
                    .pipe(process.stdout);
                this.childProcess.stderr
                    .pipe((0, output_prefix_1.addPrefixTransformer)())
                    .pipe(process.stderr);
            }
        }
        // 'close' (not 'exit') ensures stdio has drained before we join chunks (#35302).
        this.childProcess.on('close', (code, signal) => {
            if (code === null)
                code = (0, exit_codes_1.signalToCode)(signal);
            this.exitCode = code;
            // Join once and cache before notifying exit callbacks
            this.joinedTerminalOutput = this.terminalOutputChunks.join('');
            this.terminalOutputChunks = [];
            for (const cb of this.exitCallbacks) {
                cb(code, this.joinedTerminalOutput);
            }
        });
        // Re-emit any messages from the task process
        this.childProcess.on('message', (message) => {
            if (process.send) {
                process.send(message);
            }
        });
        this.childProcess.stdout.on('data', (chunk) => {
            const output = chunk.toString();
            this.terminalOutputChunks.push(output);
            // Stream output to TUI via callbacks
            for (const cb of this.outputCallbacks) {
                cb(output);
            }
        });
        this.childProcess.stderr.on('data', (chunk) => {
            const output = chunk.toString();
            this.terminalOutputChunks.push(output);
            // Stream output to TUI via callbacks
            for (const cb of this.outputCallbacks) {
                cb(output);
            }
        });
    }
    onExit(cb) {
        this.exitCallbacks.push(cb);
    }
    onOutput(cb) {
        this.outputCallbacks.push(cb);
    }
    async getResults() {
        if (typeof this.exitCode === 'number') {
            return {
                code: this.exitCode,
                terminalOutput: this.joinedTerminalOutput ?? this.terminalOutputChunks.join(''),
            };
        }
        return new Promise((res) => {
            this.onExit((code, terminalOutput) => {
                res({ code, terminalOutput });
            });
        });
    }
    send(message) {
        if (this.childProcess.connected) {
            this.childProcess.send(message);
        }
    }
    kill(signal) {
        if (this.childProcess?.pid) {
            (0, tree_kill_1.default)(this.childProcess.pid, signal, () => {
                // Ignore errors - process may have already exited
            });
        }
    }
}
exports.NodeChildProcessWithNonDirectOutput = NodeChildProcessWithNonDirectOutput;
/**
 * Prevents terminal escape sequence from clearing line prefix.
 */
function logClearLineToPrefixTransformer(prefix) {
    let prevChunk = null;
    return new stream_1.Transform({
        transform(chunk, _encoding, callback) {
            if (prevChunk && prevChunk.toString() === '\x1b[2K') {
                chunk = chunk.toString().replace(/\x1b\[1G/g, (m) => m + prefix);
            }
            this.push(chunk);
            prevChunk = chunk;
            callback();
        },
    });
}
class NodeChildProcessWithDirectOutput {
    constructor(childProcess, temporaryOutputPath) {
        this.childProcess = childProcess;
        this.temporaryOutputPath = temporaryOutputPath;
        this.exitCallbacks = [];
        this.exited = false;
        // Re-emit any messages from the task process
        this.childProcess.on('message', (message) => {
            if (process.send) {
                process.send(message);
            }
        });
        this.childProcess.on('exit', (code, signal) => {
            if (code === null)
                code = (0, exit_codes_1.signalToCode)(signal);
            this.exited = true;
            this.exitCode = code;
            for (const cb of this.exitCallbacks) {
                cb(code, signal);
            }
        });
    }
    send(message) {
        if (this.childProcess.connected) {
            this.childProcess.send(message);
        }
    }
    onExit(cb) {
        this.exitCallbacks.push(cb);
    }
    async getResults() {
        if (!this.exited) {
            await this.waitForExit();
        }
        const terminalOutput = this.getTerminalOutput();
        return { code: this.exitCode, terminalOutput };
    }
    waitForExit() {
        return new Promise((res) => {
            this.onExit(() => res());
        });
    }
    getTerminalOutput() {
        this.terminalOutput ??= (0, fs_1.readFileSync)(this.temporaryOutputPath).toString();
        return this.terminalOutput;
    }
    kill(signal) {
        if (this.childProcess?.pid) {
            (0, tree_kill_1.default)(this.childProcess.pid, signal, () => {
                // Ignore errors - process may have already exited
            });
        }
    }
}
exports.NodeChildProcessWithDirectOutput = NodeChildProcessWithDirectOutput;
