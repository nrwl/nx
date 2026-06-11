"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchFunctionRunner = void 0;
exports.watch = watch;
const child_process_1 = require("child_process");
const client_1 = require("../../daemon/client/client");
const daemon_socket_messenger_1 = require("../../daemon/client/daemon-socket-messenger");
const output_1 = require("../../utils/output");
const DEFAULT_PROJECT_NAME_ENV = 'NX_PROJECT_NAME';
const DEFAULT_FILE_CHANGES_ENV = 'NX_FILE_CHANGES';
class BatchFunctionRunner {
    get _verbose() {
        return process.env.NX_VERBOSE_LOGGING === 'true';
    }
    get hasPending() {
        return this.pendingProjects.size > 0 || this.pendingFiles.size > 0;
    }
    constructor(callback) {
        this.callback = callback;
        this.running = false;
        this.pendingProjects = new Set();
        this.pendingFiles = new Set();
    }
    enqueue(projectNames, fileChanges) {
        projectNames.forEach((projectName) => {
            this.pendingProjects.add(projectName);
        });
        fileChanges.forEach((fileChange) => {
            this.pendingFiles.add(fileChange.path);
        });
        return this.process(true);
    }
    async process(runAnyway) {
        if (!this.running && (this.hasPending || runAnyway)) {
            this.running = true;
            // Clone the pending projects and files before clearing
            const projects = new Set(this.pendingProjects);
            const files = new Set(this.pendingFiles);
            // Clear the pending projects and files
            this.pendingProjects.clear();
            this.pendingFiles.clear();
            return this.callback(projects, files).then(() => {
                this.running = false;
                this.process(false);
            });
        }
        else {
            this._verbose &&
                this.running &&
                output_1.output.logSingleLine('waiting for function to finish executing');
            this._verbose &&
                !this.hasPending &&
                output_1.output.logSingleLine('no more function to process');
        }
    }
}
exports.BatchFunctionRunner = BatchFunctionRunner;
class BatchCommandRunner extends BatchFunctionRunner {
    constructor(command, projectNameEnv = DEFAULT_PROJECT_NAME_ENV, fileChangesEnv = DEFAULT_FILE_CHANGES_ENV) {
        super((projects, files) => {
            // process all pending commands together
            const envs = this.createCommandEnvironments(projects, files);
            return this.run(envs);
        });
        this.command = command;
        this.projectNameEnv = projectNameEnv;
        this.fileChangesEnv = fileChangesEnv;
    }
    createCommandEnvironments(projects, files) {
        const commandsToRun = [];
        if (projects.size > 0) {
            projects.forEach((projectName) => {
                commandsToRun.push({
                    [this.projectNameEnv]: projectName,
                    [this.fileChangesEnv]: Array.from(files).join(' '),
                });
            });
        }
        else {
            commandsToRun.push({
                [this.projectNameEnv]: '',
                [this.fileChangesEnv]: Array.from(files).join(' '),
            });
        }
        return commandsToRun;
    }
    async run(envs) {
        this._verbose &&
            output_1.output.logSingleLine('about to run commands with these environments: ' + JSON.stringify(envs));
        return Promise.all(envs.map((env) => {
            return new Promise((resolve, reject) => {
                const commandExec = (0, child_process_1.spawn)(this.command, {
                    stdio: 'inherit',
                    shell: true,
                    cwd: process.cwd(),
                    env: {
                        ...process.env,
                        [this.projectNameEnv]: env[this.projectNameEnv],
                        [this.fileChangesEnv]: env[this.fileChangesEnv],
                    },
                    windowsHide: true,
                });
                commandExec.on('close', () => {
                    resolve();
                });
                commandExec.on('exit', () => {
                    resolve();
                });
            });
        })).then((r) => {
            this._verbose &&
                output_1.output.logSingleLine('running complete, processing the next batch');
            return r;
        });
    }
}
async function watch(args) {
    const projectReplacementRegex = new RegExp(args.projectNameEnvName ?? DEFAULT_PROJECT_NAME_ENV, 'g');
    if (!client_1.daemonClient.enabled()) {
        output_1.output.error({
            title: 'Daemon is not running. The watch command is not supported without the Nx Daemon.',
        });
        process.exit(1);
    }
    if (args.includeGlobalWorkspaceFiles &&
        args.command.match(projectReplacementRegex)) {
        output_1.output.error({
            title: 'Invalid command',
            bodyLines: [
                'The command you provided has a replacement for projects ($NX_PROJECT_NAME), but you are also including global workspace files.',
                'You cannot use a replacement for projects when including global workspace files because there will be scenarios where there are file changes not associated with a project.',
            ],
        });
        process.exit(1);
    }
    args.verbose &&
        output_1.output.logSingleLine('running with args: ' + JSON.stringify(args));
    args.verbose && output_1.output.logSingleLine('starting watch process');
    const whatToWatch = args.all ? 'all' : args.projects;
    const batchQueue = new BatchCommandRunner(args.command ?? '', args.projectNameEnvName, args.fileChangesEnvName);
    // Run the command initially if requested
    if (args.initialRun) {
        args.verbose && output_1.output.logSingleLine('running command initially...');
        const initialProjects = args.all
            ? [] // When using --all, we don't need to pass specific projects
            : args.projects || [];
        // Execute the initial run
        await batchQueue.enqueue(initialProjects, []);
    }
    await client_1.daemonClient.registerFileWatcher({
        watchProjects: whatToWatch,
        includeDependentProjects: args.includeDependentProjects,
        includeGlobalWorkspaceFiles: args.includeGlobalWorkspaceFiles,
    }, async (err, data) => {
        if (err === 'reconnecting') {
            // Silent - daemon restarts automatically on lockfile changes
            return;
        }
        else if (err === 'reconnected') {
            // Silent - reconnection succeeded
            return;
        }
        else if (err === 'closed') {
            output_1.output.error({
                title: 'Failed to reconnect to daemon after multiple attempts',
                bodyLines: ['Please restart your watch command.'],
            });
            process.exit(1);
        }
        else if (err instanceof daemon_socket_messenger_1.VersionMismatchError) {
            output_1.output.error({
                title: 'Nx version changed. Please restart your command.',
            });
            process.exit(1);
        }
        else if (err !== null) {
            output_1.output.error({
                title: 'Watch error',
                bodyLines: [
                    'An error occurred during the watch process:',
                    err.message,
                ],
            });
        }
        // Only pass the projects to the queue if the command has a replacement for projects
        if (args.command.match(projectReplacementRegex)) {
            batchQueue.enqueue(data.changedProjects, data.changedFiles);
        }
        else {
            batchQueue.enqueue([], data.changedFiles);
        }
    });
    args.verbose && output_1.output.logSingleLine('watch process waiting...');
    // Keep the process alive while watching for file changes
    // The file watcher callbacks will handle incoming events
    // The process will exit when Ctrl+C is pressed or if the connection closes
    await new Promise(() => { });
}
