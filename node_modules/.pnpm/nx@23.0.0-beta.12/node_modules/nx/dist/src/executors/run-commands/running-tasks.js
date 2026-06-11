"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeriallyRunningTasks = exports.ParallelRunningTasks = void 0;
exports.runSingleCommandWithPseudoTerminal = runSingleCommandWithPseudoTerminal;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const child_process_1 = require("child_process");
const npm_run_path_1 = require("npm-run-path");
const path_1 = require("path");
const tree_kill_1 = tslib_1.__importDefault(require("tree-kill"));
const pseudo_terminal_1 = require("../../tasks-runner/pseudo-terminal");
const task_env_1 = require("../../tasks-runner/task-env");
const task_io_service_1 = require("../../tasks-runner/task-io-service");
const exit_codes_1 = require("../../utils/exit-codes");
class ParallelRunningTasks {
    constructor(options, context, taskId) {
        this.exitCallbacks = [];
        this.outputCallbacks = [];
        this.childProcesses = options.commands.map((commandConfig) => new RunningNodeProcess(commandConfig, options.color, calculateCwd(options.cwd, context), options.env ?? {}, options.readyWhenStatus, options.streamOutput, options.envFile, taskId));
        this.readyWhenStatus = options.readyWhenStatus;
        this.streamOutput = options.streamOutput;
        this.run();
    }
    async getResults() {
        return new Promise((res) => {
            this.onExit((code, terminalOutput) => {
                res({ code, terminalOutput });
            });
        });
    }
    onOutput(cb) {
        this.outputCallbacks.push(cb);
    }
    onExit(cb) {
        this.exitCallbacks.push(cb);
    }
    send(message) {
        for (const childProcess of this.childProcesses) {
            childProcess.send(message);
        }
    }
    async kill(signal) {
        await Promise.all(this.childProcesses.map(async (p) => {
            try {
                return p.kill();
            }
            catch (e) {
                console.error(`Unable to terminate "${p.command}"\nError:`, e);
            }
        }));
    }
    async run() {
        if (this.readyWhenStatus.length) {
            let { childProcess, result: { code, terminalOutput }, } = await Promise.race(this.childProcesses.map((childProcess) => new Promise((res) => {
                childProcess.onOutput((terminalOutput) => {
                    for (const cb of this.outputCallbacks) {
                        cb(terminalOutput);
                    }
                });
                childProcess.onExit((code, terminalOutput) => {
                    res({
                        childProcess,
                        result: { code, terminalOutput },
                    });
                });
            })));
            if (code !== 0) {
                const output = `Warning: command "${childProcess.command}" exited with non-zero status code`;
                terminalOutput += output;
                if (this.streamOutput) {
                    process.stderr.write(output);
                }
            }
            for (const cb of this.exitCallbacks) {
                cb(code, terminalOutput);
            }
        }
        else {
            const runningProcesses = new Set();
            let hasFailure = false;
            let failureDetails = null;
            const terminalOutputs = new Map();
            await Promise.allSettled(this.childProcesses.map(async (childProcess) => {
                runningProcesses.add(childProcess);
                childProcess.onOutput((terminalOutput) => {
                    for (const cb of this.outputCallbacks) {
                        cb(terminalOutput);
                    }
                });
                const { code, terminalOutput } = await childProcess.getResults();
                terminalOutputs.set(childProcess, terminalOutput);
                if (code !== 0 && !hasFailure) {
                    hasFailure = true;
                    failureDetails = { childProcess, code, terminalOutput };
                    // Immediately terminate all other running processes
                    await this.terminateRemainingProcesses(runningProcesses, childProcess);
                }
                runningProcesses.delete(childProcess);
            }));
            let terminalOutput = Array.from(terminalOutputs.values()).join('\r\n');
            if (hasFailure && failureDetails) {
                // Add failure message
                const output = `Warning: command "${failureDetails.childProcess.command}" exited with non-zero status code`;
                terminalOutput += output;
                if (this.streamOutput) {
                    process.stderr.write(output);
                }
                for (const cb of this.exitCallbacks) {
                    cb(1, terminalOutput);
                }
            }
            else {
                for (const cb of this.exitCallbacks) {
                    cb(0, terminalOutput);
                }
            }
        }
    }
    async terminateRemainingProcesses(runningProcesses, failedProcess) {
        const terminationPromises = [];
        const processesToTerminate = [...runningProcesses].filter((p) => p !== failedProcess);
        for (const process of processesToTerminate) {
            runningProcesses.delete(process);
            // Terminate the process
            terminationPromises.push(process.kill('SIGTERM').catch((err) => {
                // Log error but don't fail the entire operation
                if (this.streamOutput) {
                    console.error(`Failed to terminate process "${process.command}":`, err);
                }
            }));
        }
        // Wait for all terminations to complete with a timeout
        if (terminationPromises.length > 0) {
            await Promise.race([
                Promise.all(terminationPromises),
                new Promise((resolve) => setTimeout(resolve, 5_000)),
            ]);
        }
    }
}
exports.ParallelRunningTasks = ParallelRunningTasks;
class SeriallyRunningTasks {
    constructor(options, context, tuiEnabled, taskId) {
        this.tuiEnabled = tuiEnabled;
        this.taskId = taskId;
        this.terminalOutputChunks = [];
        this.currentProcess = null;
        this.exitCallbacks = [];
        this.code = 0;
        this.outputCallbacks = [];
        this.run(options, context)
            .catch((e) => {
            this.error = e;
        })
            .finally(() => {
            const terminalOutput = this.terminalOutputChunks.join('');
            this.terminalOutputChunks = [];
            for (const cb of this.exitCallbacks) {
                cb(this.code, terminalOutput);
            }
        });
    }
    getResults() {
        return new Promise((res, rej) => {
            this.onExit((code, terminalOutput) => {
                if (this.error) {
                    rej(this.error);
                }
                else {
                    res({ code, terminalOutput });
                }
            });
        });
    }
    onExit(cb) {
        this.exitCallbacks.push(cb);
    }
    onOutput(cb) {
        this.outputCallbacks.push(cb);
    }
    send(message) {
        throw new Error('Not implemented');
    }
    kill(signal) {
        return this.currentProcess.kill(signal);
    }
    async run(options, context) {
        for (const c of options.commands) {
            const childProcess = await this.createProcess(c, options.color, calculateCwd(options.cwd, context), options.processEnv ?? options.env ?? {}, this.taskId, options.usePty, options.streamOutput, options.tty, options.envFile);
            this.currentProcess = childProcess;
            childProcess.onOutput((output) => {
                for (const cb of this.outputCallbacks) {
                    cb(output);
                }
            });
            let { code, terminalOutput } = await childProcess.getResults();
            this.terminalOutputChunks.push(terminalOutput);
            this.code = code;
            if (code !== 0) {
                const output = `Warning: command "${c.command}" exited with non-zero status code`;
                if (options.streamOutput) {
                    process.stderr.write(output);
                }
                this.terminalOutputChunks.push(output);
                // Stop running commands
                break;
            }
        }
    }
    async createProcess(commandConfig, color, cwd, env, taskId, usePty = true, streamOutput = true, tty, envFile) {
        // The rust runCommand is always a tty, so it will not look nice in parallel and if we need prefixes
        // currently does not work properly in windows
        if (process.env.NX_NATIVE_COMMAND_RUNNER !== 'false' &&
            !commandConfig.prefix &&
            usePty &&
            pseudo_terminal_1.PseudoTerminal.isSupported()) {
            const pseudoTerminal = (0, pseudo_terminal_1.createPseudoTerminal)();
            registerProcessListener(this, pseudoTerminal);
            const pseudoTtyProcess = await createProcessWithPseudoTty(pseudoTerminal, commandConfig, color, cwd, env, streamOutput, tty, envFile);
            // Register process for metrics collection (direct run-commands execution)
            // Skip registration if we're in a forked executor - the fork wrapper already registered
            const pid = pseudoTtyProcess.getPid();
            if (pid && !process.env.NX_FORKED_TASK_EXECUTOR) {
                (0, task_io_service_1.registerTaskProcessStart)(taskId, pid);
            }
            return pseudoTtyProcess;
        }
        return new RunningNodeProcess(commandConfig, color, cwd, env, [], streamOutput, envFile, taskId);
    }
}
exports.SeriallyRunningTasks = SeriallyRunningTasks;
class RunningNodeProcess {
    constructor(commandConfig, color, cwd, env, readyWhenStatus, streamOutput = true, envFile, taskId) {
        this.readyWhenStatus = readyWhenStatus;
        this.taskId = taskId;
        this.terminalOutputChunks = [];
        this.exitCallbacks = [];
        this.outputCallbacks = [];
        env = processEnv(color, cwd, env, envFile);
        this.command = commandConfig.command;
        const header = pc.dim('> ') + commandConfig.command + '\r\n\r\n';
        this.terminalOutputChunks.push(header);
        if (streamOutput) {
            process.stdout.write(header);
        }
        this.childProcess = (0, child_process_1.spawn)(commandConfig.command, [], {
            shell: true,
            env,
            cwd,
            windowsHide: true,
        });
        this.childProcess.stdout?.setEncoding('utf8');
        this.childProcess.stderr?.setEncoding('utf8');
        // Register process for metrics collection
        // Skip registration if we're in a forked executor - the fork wrapper already registered
        if (this.childProcess.pid && !process.env.NX_FORKED_TASK_EXECUTOR) {
            (0, task_io_service_1.registerTaskProcessStart)(taskId, this.childProcess.pid);
        }
        this.addListeners(commandConfig, streamOutput);
    }
    getResults() {
        return new Promise((res) => {
            this.onExit((code, terminalOutput) => {
                res({ code, terminalOutput });
            });
        });
    }
    onOutput(cb) {
        this.outputCallbacks.push(cb);
    }
    onExit(cb) {
        this.exitCallbacks.push(cb);
    }
    send(message) {
        this.childProcess.send(message);
    }
    kill(signal) {
        return new Promise((res, rej) => {
            (0, tree_kill_1.default)(this.childProcess.pid, signal, (err) => {
                // On Windows, tree-kill (which uses taskkill) may fail when the process or its child process is already terminated.
                // Ignore the errors, otherwise we will log them unnecessarily.
                if (err && process.platform !== 'win32') {
                    rej(err);
                }
                else {
                    res();
                }
            });
        });
    }
    triggerOutputListeners(output) {
        for (const cb of this.outputCallbacks) {
            cb(output);
        }
    }
    addListeners(commandConfig, streamOutput) {
        this.childProcess.stdout.on('data', (data) => {
            const output = addColorAndPrefix(data, commandConfig);
            this.terminalOutputChunks.push(output);
            this.triggerOutputListeners(output);
            if (streamOutput) {
                process.stdout.write(output);
            }
            if (this.readyWhenStatus.length &&
                isReady(this.readyWhenStatus, data.toString())) {
                for (const cb of this.exitCallbacks) {
                    cb(0, this.terminalOutputChunks.join(''));
                }
            }
        });
        this.childProcess.stderr.on('data', (err) => {
            const output = addColorAndPrefix(err, commandConfig);
            this.terminalOutputChunks.push(output);
            this.triggerOutputListeners(output);
            if (streamOutput) {
                process.stderr.write(output);
            }
            if (this.readyWhenStatus.length &&
                isReady(this.readyWhenStatus, err.toString())) {
                for (const cb of this.exitCallbacks) {
                    cb(1, this.terminalOutputChunks.join(''));
                }
            }
        });
        this.childProcess.on('error', (err) => {
            const output = addColorAndPrefix(err.toString(), commandConfig);
            this.terminalOutputChunks.push(output);
            if (streamOutput) {
                process.stderr.write(output);
            }
            const terminalOutput = this.terminalOutputChunks.join('');
            this.terminalOutputChunks = [];
            removeProcessListeners();
            for (const cb of this.exitCallbacks) {
                cb(1, terminalOutput);
            }
        });
        // Store signal/exit handlers so they can be removed when the child exits.
        // Without cleanup, each RunningNodeProcess leaks 4 process listeners.
        // In a large monorepo (2600+ run-commands tasks), these accumulate and
        // cause a multi-minute synchronous hang at process.exit() as each handler
        // calls treeKill on an already-dead PID.
        const onExit = () => {
            this.kill();
        };
        const onSigInt = () => {
            this.kill('SIGTERM');
        };
        const onSigTerm = () => {
            this.kill('SIGTERM');
        };
        const onSigHup = () => {
            this.kill('SIGTERM');
        };
        const removeProcessListeners = () => {
            process.removeListener('exit', onExit);
            process.removeListener('SIGINT', onSigInt);
            process.removeListener('SIGTERM', onSigTerm);
            process.removeListener('SIGHUP', onSigHup);
        };
        this.childProcess.on('exit', (code, signal) => {
            if (code === null) {
                code = (0, exit_codes_1.signalToCode)(signal);
            }
            removeProcessListeners();
            if (!this.readyWhenStatus.length || isReady(this.readyWhenStatus)) {
                const terminalOutput = this.terminalOutputChunks.join('');
                this.terminalOutputChunks = [];
                for (const cb of this.exitCallbacks) {
                    cb(code, terminalOutput);
                }
            }
        });
        // Terminate any task processes on exit
        process.on('exit', onExit);
        process.on('SIGINT', onSigInt);
        process.on('SIGTERM', onSigTerm);
        process.on('SIGHUP', onSigHup);
    }
}
async function runSingleCommandWithPseudoTerminal(normalized, context, taskId) {
    const pseudoTerminal = (0, pseudo_terminal_1.createPseudoTerminal)();
    const pseudoTtyProcess = await createProcessWithPseudoTty(pseudoTerminal, normalized.commands[0], normalized.color, calculateCwd(normalized.cwd, context), normalized.env, normalized.streamOutput, pseudoTerminal ? normalized.isTTY : false, normalized.envFile);
    // Register process for metrics collection (direct run-commands execution)
    // Skip registration if we're in a forked executor - the fork wrapper already registered
    const pid = pseudoTtyProcess.getPid();
    if (pid && !process.env.NX_FORKED_TASK_EXECUTOR) {
        (0, task_io_service_1.registerTaskProcessStart)(taskId, pid);
    }
    registerProcessListener(pseudoTtyProcess, pseudoTerminal);
    return pseudoTtyProcess;
}
async function createProcessWithPseudoTty(pseudoTerminal, commandConfig, color, cwd, env, streamOutput = true, tty, envFile) {
    return pseudoTerminal.runCommand(commandConfig.command, {
        cwd,
        jsEnv: processEnv(color, cwd, env, envFile),
        quiet: !streamOutput,
        tty,
    });
}
function addColorAndPrefix(out, config) {
    if (config.prefix) {
        out = out
            .split('\n')
            .map((l) => {
            let prefixText = config.prefix;
            if (config.prefixColor && pc[config.prefixColor]) {
                prefixText = pc[config.prefixColor](prefixText);
            }
            prefixText = pc.bold(prefixText);
            return l.trim().length > 0 ? `${prefixText} ${l}` : l;
        })
            .join('\n');
    }
    if (config.color && pc[config.color]) {
        out = pc[config.color](out);
    }
    if (config.bgColor && pc[config.bgColor]) {
        out = pc[config.bgColor](out);
    }
    return out;
}
function calculateCwd(cwd, context) {
    if (!cwd)
        return context.root;
    if ((0, path_1.isAbsolute)(cwd))
        return cwd;
    return (0, path_1.join)(context.root, cwd);
}
/**
 * Env variables are processed in the following order:
 * - env option from executor options
 * - env file from envFile option if provided
 * - local env variables
 */
function processEnv(color, cwd, envOptionFromExecutor, envFile) {
    let localEnv = (0, npm_run_path_1.env)({ cwd: cwd ?? process.cwd() });
    localEnv = {
        ...process.env,
        ...localEnv,
    };
    if (process.env.NX_LOAD_DOT_ENV_FILES !== 'false' && envFile) {
        loadEnvVarsFile(envFile, localEnv);
    }
    let res = {
        ...localEnv,
        ...envOptionFromExecutor,
    };
    // need to override PATH to make sure we are using the local node_modules
    if (localEnv.PATH)
        res.PATH = localEnv.PATH; // UNIX-like
    if (localEnv.Path)
        res.Path = localEnv.Path; // Windows
    if (color) {
        res.FORCE_COLOR = `${color}`;
    }
    // Don't leak NX_PREFIX_OUTPUT to child processes — the parent
    // task-orchestrator handles prefixing, not the spawned commands.
    delete res.NX_PREFIX_OUTPUT;
    return res;
}
function isReady(readyWhenStatus = [], data) {
    if (data) {
        for (const readyWhenElement of readyWhenStatus) {
            if (data.toString().indexOf(readyWhenElement.stringToMatch) > -1) {
                readyWhenElement.found = true;
                break;
            }
        }
    }
    return readyWhenStatus.every((readyWhenElement) => readyWhenElement.found);
}
function loadEnvVarsFile(path, env = {}) {
    (0, task_env_1.unloadDotEnvFile)(path, env);
    const result = (0, task_env_1.loadAndExpandDotEnvFile)(path, env);
    if (result.error) {
        throw result.error;
    }
}
let registered = false;
function registerProcessListener(runningTask, pseudoTerminal) {
    if (registered) {
        return;
    }
    registered = true;
    // When the nx process gets a message, it will be sent into the task's process
    process.on('message', (message) => {
        // this.publisher.publish(message.toString());
        if (pseudoTerminal) {
            pseudoTerminal.sendMessageToChildren(message);
        }
        if ('send' in runningTask) {
            runningTask.send(message);
        }
    });
    // Terminate any task processes on exit
    process.on('exit', () => {
        runningTask.kill();
    });
    process.on('SIGINT', () => {
        runningTask.kill('SIGTERM');
    });
    process.on('SIGTERM', () => {
        runningTask.kill('SIGTERM');
        // no exit here because we expect child processes to terminate which
        // will store results to the cache and will terminate this process
    });
    process.on('SIGHUP', () => {
        runningTask.kill('SIGTERM');
        // no exit here because we expect child processes to terminate which
        // will store results to the cache and will terminate this process
    });
}
