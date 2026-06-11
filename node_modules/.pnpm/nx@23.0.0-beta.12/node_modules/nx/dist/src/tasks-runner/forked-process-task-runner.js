"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForkedProcessTaskRunner = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const output_1 = require("../utils/output");
const strip_indents_1 = require("../utils/strip-indents");
const batch_messages_1 = require("./batch/batch-messages");
const process_metrics_service_1 = require("./process-metrics-service");
const pseudo_terminal_1 = require("./pseudo-terminal");
const batch_process_1 = require("./running-tasks/batch-process");
const node_child_process_1 = require("./running-tasks/node-child-process");
const task_io_service_1 = require("./task-io-service");
const utils_1 = require("./utils");
const forkScript = (0, path_1.join)(__dirname, './fork.js');
const workerPath = (0, path_1.join)(__dirname, './batch/run-batch.js');
class ForkedProcessTaskRunner {
    constructor(options, tuiEnabled) {
        this.options = options;
        this.tuiEnabled = tuiEnabled;
        this.cliPath = (0, utils_1.getCliPath)();
        this.verbose = process.env.NX_VERBOSE_LOGGING === 'true';
        this.processes = new Set();
        this.finishedProcesses = new Set();
        this.pseudoTerminals = new Set();
    }
    async init() {
        this.setupProcessEventListeners();
    }
    // TODO: vsavkin delegate terminal output printing
    async forkProcessForBatch({ id: batchId, executorName, taskGraph: batchTaskGraph }, projectGraph, fullTaskGraph, env) {
        const count = Object.keys(batchTaskGraph.tasks).length;
        if (count > 1) {
            output_1.output.logSingleLine(`Running ${output_1.output.bold(count)} ${output_1.output.bold('tasks')} with ${output_1.output.bold(executorName)}`);
        }
        else {
            const args = (0, utils_1.getPrintableCommandArgsForTask)(Object.values(batchTaskGraph.tasks)[0]);
            output_1.output.logCommand(args.join(' '));
        }
        const p = (0, child_process_1.fork)(workerPath, {
            stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
            env: {
                ...env,
                NX_FORKED_TASK_EXECUTOR: 'true',
            },
        });
        // Register batch worker process with all tasks
        if (p.pid) {
            const taskIds = Object.keys(batchTaskGraph.tasks);
            (0, process_metrics_service_1.getProcessMetricsService)().registerBatch(batchId, taskIds, p.pid);
        }
        const cp = new batch_process_1.BatchProcess(p, executorName);
        this.processes.add(cp);
        cp.onExit(() => {
            this.processes.delete(cp);
        });
        // Start the tasks
        cp.send({
            type: batch_messages_1.BatchMessageType.RunTasks,
            executorName,
            projectGraph,
            batchTaskGraph,
            fullTaskGraph,
        });
        return cp;
    }
    cleanUpBatchProcesses() {
        if (this.finishedProcesses.size > 0) {
            this.finishedProcesses.forEach((p) => {
                p.kill();
            });
            this.finishedProcesses.clear();
        }
    }
    async forkProcessLegacy(task, { temporaryOutputPath, streamOutput, pipeOutput, taskGraph, env, }) {
        return pipeOutput
            ? this.forkProcessWithPrefixAndNotTTY(task, {
                temporaryOutputPath,
                streamOutput,
                taskGraph,
                env,
            })
            : this.forkProcessDirectOutputCapture(task, {
                temporaryOutputPath,
                streamOutput,
                taskGraph,
                env,
            });
    }
    async forkProcess(task, { temporaryOutputPath, streamOutput, taskGraph, env, disablePseudoTerminal, }) {
        const shouldPrefix = streamOutput &&
            process.env.NX_PREFIX_OUTPUT === 'true' &&
            !this.tuiEnabled;
        // streamOutput would be false if we are running multiple targets
        // there's no point in running the commands in a pty if we are not streaming the output
        if (pseudo_terminal_1.PseudoTerminal.isSupported() &&
            !disablePseudoTerminal &&
            (this.tuiEnabled || (streamOutput && !shouldPrefix))) {
            // Use pseudo-terminal for interactive tasks that can support user input
            return this.forkProcessWithPseudoTerminal(task, {
                temporaryOutputPath,
                streamOutput,
                taskGraph,
                env,
            });
        }
        else {
            // Use non-interactive process with piped output
            // Tradeoff: These tasks cannot support interactivity but can still provide
            // progressive output to the TUI if it's enabled
            return this.forkProcessWithPrefixAndNotTTY(task, {
                temporaryOutputPath,
                streamOutput,
                taskGraph,
                env,
            });
        }
    }
    async createPseudoTerminal() {
        // Use the helper to ensure shutdown callbacks are registered
        const terminal = (0, pseudo_terminal_1.createPseudoTerminal)(true);
        await terminal.init();
        terminal.onMessageFromChildren((message) => {
            process.send(message);
        });
        return terminal;
    }
    async forkProcessWithPseudoTerminal(task, { temporaryOutputPath, streamOutput, taskGraph, env, }) {
        const childId = task.id;
        const pseudoTerminal = await this.createPseudoTerminal();
        this.pseudoTerminals.add(pseudoTerminal);
        const p = await pseudoTerminal.fork(childId, forkScript, {
            cwd: process.cwd(),
            execArgv: process.execArgv,
            jsEnv: {
                ...env,
                NX_FORKED_TASK_EXECUTOR: 'true',
            },
            quiet: !streamOutput,
            commandLabel: `nx run ${task.id}`,
        });
        // Register forked process for metrics collection
        const pid = p.getPid();
        if (pid) {
            (0, task_io_service_1.registerTaskProcessStart)(task.id, pid);
        }
        p.send({
            targetDescription: task.target,
            overrides: task.overrides,
            taskGraph,
            isVerbose: this.verbose,
        });
        this.processes.add(p);
        p.onExit((code, terminalOutput) => {
            if (!this.tuiEnabled && code > 128) {
                process.exit(code);
            }
            this.pseudoTerminals.delete(pseudoTerminal);
            this.processes.delete(p);
            if (!streamOutput) {
                this.options.lifeCycle.printTaskTerminalOutput(task, code === 0 ? 'success' : 'failure', terminalOutput);
            }
            this.writeTerminalOutput(temporaryOutputPath, terminalOutput);
        });
        return p;
    }
    forkProcessWithPrefixAndNotTTY(task, { streamOutput, temporaryOutputPath, taskGraph, env, }) {
        try {
            const args = (0, utils_1.getPrintableCommandArgsForTask)(task);
            if (streamOutput) {
                output_1.output.logCommand(args.join(' '));
            }
            const p = (0, child_process_1.fork)(this.cliPath, {
                stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
                env: {
                    ...env,
                    NX_FORKED_TASK_EXECUTOR: 'true',
                },
            });
            // Register forked process for metrics collection
            if (p.pid) {
                (0, task_io_service_1.registerTaskProcessStart)(task.id, p.pid);
            }
            // Send message to run the executor
            p.send({
                targetDescription: task.target,
                overrides: task.overrides,
                taskGraph,
                isVerbose: this.verbose,
            });
            const cp = new node_child_process_1.NodeChildProcessWithNonDirectOutput(p, {
                streamOutput,
                prefix: task.target.project,
            });
            this.processes.add(cp);
            cp.onExit((code, terminalOutput) => {
                this.processes.delete(cp);
                if (!streamOutput) {
                    this.options.lifeCycle.printTaskTerminalOutput(task, code === 0 ? 'success' : 'failure', terminalOutput);
                }
                this.writeTerminalOutput(temporaryOutputPath, terminalOutput);
            });
            return cp;
        }
        catch (e) {
            console.error(e);
            throw e;
        }
    }
    forkProcessDirectOutputCapture(task, { streamOutput, temporaryOutputPath, taskGraph, env, }) {
        try {
            const args = (0, utils_1.getPrintableCommandArgsForTask)(task);
            if (streamOutput) {
                output_1.output.logCommand(args.join(' '));
            }
            const p = (0, child_process_1.fork)(this.cliPath, {
                stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
                env: {
                    ...env,
                    NX_FORKED_TASK_EXECUTOR: 'true',
                },
            });
            // Register forked process for metrics collection
            if (p.pid) {
                (0, task_io_service_1.registerTaskProcessStart)(task.id, p.pid);
            }
            const cp = new node_child_process_1.NodeChildProcessWithDirectOutput(p, temporaryOutputPath);
            this.processes.add(cp);
            // Send message to run the executor
            p.send({
                targetDescription: task.target,
                overrides: task.overrides,
                taskGraph,
                isVerbose: this.verbose,
            });
            cp.onExit((code, signal) => {
                this.processes.delete(cp);
                // we didn't print any output as we were running the command
                // print all the collected output
                try {
                    const terminalOutput = cp.getTerminalOutput();
                    if (!streamOutput) {
                        this.options.lifeCycle.printTaskTerminalOutput(task, code === 0 ? 'success' : 'failure', terminalOutput);
                    }
                }
                catch (e) {
                    console.log((0, strip_indents_1.stripIndents) `
              Unable to print terminal output for Task "${task.id}".
              Task failed with Exit Code ${code} and Signal "${signal}".

              Received error message:
              ${e.message}
            `);
                }
            });
            return cp;
        }
        catch (e) {
            console.error(e);
            throw e;
        }
    }
    writeTerminalOutput(outputPath, content) {
        (0, fs_1.writeFileSync)(outputPath, content);
    }
    cleanup(signal) {
        this.processes.forEach((p) => {
            p.kill(signal);
        });
        this.cleanUpBatchProcesses();
    }
    setupProcessEventListeners() {
        const messageHandler = (message) => {
            this.pseudoTerminals.forEach((p) => {
                p.sendMessageToChildren(message);
            });
            this.processes.forEach((p) => {
                if ('connected' in p && p.connected && 'send' in p) {
                    p.send(message);
                }
            });
        };
        // When the nx process gets a message, it will be sent into the task's process
        process.on('message', messageHandler);
        // Terminate any task processes on exit
        process.once('exit', () => {
            this.cleanup();
            process.off('message', messageHandler);
        });
        // Signal handlers removed - TaskOrchestrator owns signal handling
    }
}
exports.ForkedProcessTaskRunner = ForkedProcessTaskRunner;
