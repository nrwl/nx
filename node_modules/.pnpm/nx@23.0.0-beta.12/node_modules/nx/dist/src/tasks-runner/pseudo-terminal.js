"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PseudoTtyProcessWithSend = exports.PseudoTtyProcess = exports.PseudoTerminal = void 0;
exports.createPseudoTerminal = createPseudoTerminal;
const tslib_1 = require("tslib");
const os = tslib_1.__importStar(require("os"));
const socket_utils_1 = require("../daemon/socket-utils");
const native_1 = require("../native");
const pseudo_ipc_1 = require("./pseudo-ipc");
const exit_codes_1 = require("../utils/exit-codes");
// Register single event listeners for all pseudo-terminal instances
const pseudoTerminalShutdownCallbacks = [];
process.on('exit', (code) => {
    pseudoTerminalShutdownCallbacks.forEach((cb) => cb(code));
});
function createPseudoTerminal(skipSupportCheck = false) {
    if (!skipSupportCheck && !PseudoTerminal.isSupported()) {
        throw new Error('Pseudo terminal is not supported on this platform.');
    }
    const pseudoTerminal = new PseudoTerminal(new native_1.RustPseudoTerminal());
    pseudoTerminalShutdownCallbacks.push(pseudoTerminal.shutdown.bind(pseudoTerminal));
    return pseudoTerminal;
}
let id = 0;
class PseudoTerminal {
    static isSupported() {
        return process.stdout.isTTY && supportedPtyPlatform();
    }
    constructor(rustPseudoTerminal) {
        this.rustPseudoTerminal = rustPseudoTerminal;
        this.pseudoIPCPath = (0, socket_utils_1.getForkedProcessOsSocketPath)(process.pid.toString() + '-' + id++);
        this.pseudoIPC = new pseudo_ipc_1.PseudoIPCServer(this.pseudoIPCPath);
        this.initialized = false;
        this.childProcesses = new Set();
    }
    async init() {
        if (this.initialized) {
            return;
        }
        await this.pseudoIPC.init();
        this.initialized = true;
    }
    shutdown(code) {
        for (const cp of this.childProcesses) {
            try {
                cp.kill((0, exit_codes_1.codeToSignal)(code));
            }
            catch { }
        }
        if (this.initialized) {
            this.pseudoIPC.close();
        }
    }
    runCommand(command, { cwd, execArgv, jsEnv, quiet, tty, } = {}) {
        const cp = new PseudoTtyProcess(this.rustPseudoTerminal, this.rustPseudoTerminal.runCommand(command, cwd, jsEnv, execArgv, quiet, tty));
        this.childProcesses.add(cp);
        return cp;
    }
    async fork(id, script, { cwd, execArgv, jsEnv, quiet, commandLabel, }) {
        if (!this.initialized) {
            throw new Error('Call init() before forking processes');
        }
        const cp = new PseudoTtyProcessWithSend(this.rustPseudoTerminal, this.rustPseudoTerminal.fork(id, script, this.pseudoIPCPath, cwd, jsEnv, execArgv, quiet, commandLabel), id, this.pseudoIPC);
        this.childProcesses.add(cp);
        await this.pseudoIPC.waitForChildReady(id);
        return cp;
    }
    sendMessageToChildren(message) {
        this.pseudoIPC.sendMessageToChildren(message);
    }
    onMessageFromChildren(callback) {
        this.pseudoIPC.onMessageFromChildren(callback);
    }
}
exports.PseudoTerminal = PseudoTerminal;
class PseudoTtyProcess {
    constructor(rustPseudoTerminal, childProcess) {
        this.rustPseudoTerminal = rustPseudoTerminal;
        this.childProcess = childProcess;
        this.isAlive = true;
        this.exitCallbacks = [];
        this.outputCallbacks = [];
        this.terminalOutputChunks = [];
        childProcess.onOutput((output) => {
            this.terminalOutputChunks.push(output);
            this.outputCallbacks.forEach((cb) => cb(output));
        });
        childProcess.onExit((message) => {
            this.isAlive = false;
            const code = (0, exit_codes_1.messageToCode)(message);
            childProcess.cleanup();
            const terminalOutput = this.terminalOutputChunks.join('');
            this.terminalOutputChunks = [];
            this.exitCallbacks.forEach((cb) => cb(code, terminalOutput));
        });
    }
    async getResults() {
        return new Promise((res) => {
            this.onExit((code, terminalOutput) => {
                res({ code, terminalOutput });
            });
        });
    }
    onExit(callback) {
        this.exitCallbacks.push(callback);
    }
    onOutput(callback) {
        this.outputCallbacks.push(callback);
    }
    getPid() {
        return this.childProcess.getPid();
    }
    kill(s) {
        if (this.isAlive) {
            try {
                this.childProcess.kill(s || 'SIGTERM');
            }
            catch {
                // when the child process completes before we explicitly call kill, this will throw
                // do nothing
            }
            finally {
                this.isAlive = false;
            }
        }
    }
    getParserAndWriter() {
        return this.childProcess.getParserAndWriter();
    }
}
exports.PseudoTtyProcess = PseudoTtyProcess;
class PseudoTtyProcessWithSend extends PseudoTtyProcess {
    constructor(rustPseudoTerminal, _childProcess, id, pseudoIpc) {
        super(rustPseudoTerminal, _childProcess);
        this.rustPseudoTerminal = rustPseudoTerminal;
        this.id = id;
        this.pseudoIpc = pseudoIpc;
    }
    send(message) {
        this.pseudoIpc.sendMessageToChild(this.id, message);
    }
}
exports.PseudoTtyProcessWithSend = PseudoTtyProcessWithSend;
function supportedPtyPlatform() {
    if (native_1.IS_WASM) {
        return false;
    }
    if (process.platform !== 'win32') {
        return true;
    }
    // TODO: Re-enable Windows support when it's stable
    // Currently, there's an issue with control chars.
    // See: https://github.com/nrwl/nx/issues/22358
    if (process.env.NX_WINDOWS_PTY_SUPPORT !== 'true') {
        return false;
    }
    let windowsVersion = os.release().split('.');
    let windowsBuild = windowsVersion[2];
    if (!windowsBuild) {
        return false;
    }
    // Mininum supported Windows version:
    // https://en.wikipedia.org/wiki/Windows_10,_version_1809
    // https://learn.microsoft.com/en-us/windows/console/createpseudoconsole#requirements
    if (+windowsBuild < 17763) {
        return false;
    }
    else {
        return true;
    }
}
