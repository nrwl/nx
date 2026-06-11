"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const tslib_1 = require("tslib");
const child_process_1 = require("child_process");
const path = tslib_1.__importStar(require("path"));
const tree_kill_1 = tslib_1.__importDefault(require("tree-kill"));
const pseudo_terminal_1 = require("../../tasks-runner/pseudo-terminal");
const package_manager_1 = require("../../utils/package-manager");
async function default_1(options, context) {
    const pm = (0, package_manager_1.getPackageManagerCommand)();
    try {
        let command = pm.run(options.script, options.__unparsed__.join(' '));
        let cwd = path.join(context.root, context.projectsConfigurations.projects[context.projectName].root);
        let env = process.env;
        // when running nx through npx with node_modules installed with npm, the path gets modified to include the full workspace path with the node_modules folder
        // This causes issues when running in a pty process, so we filter out the node_modules paths from the PATH
        // Since the command here will be run with the package manager script command, the path will be modified again within the PTY process itself.
        let filteredPath = env.PATH?.split(path.delimiter)
            .filter((p) => !p.startsWith(path.join(context.root, 'node_modules')))
            .join(path.delimiter) ?? '';
        env.PATH = filteredPath;
        if (pseudo_terminal_1.PseudoTerminal.isSupported()) {
            await ptyProcess(command, cwd, env);
        }
        else {
            await nodeProcess(command, cwd, env);
        }
        return { success: true };
    }
    catch (e) {
        return { success: false };
    }
}
function nodeProcess(command, cwd, env) {
    return new Promise((res, rej) => {
        let cp = (0, child_process_1.spawn)(command, [], {
            shell: true,
            cwd,
            env,
            windowsHide: true,
        });
        // Forward stdout/stderr to parent process
        cp.stdout.pipe(process.stdout);
        cp.stderr.pipe(process.stderr);
        cp.on('error', (error) => {
            rej(error);
        });
        cp.on('exit', (code) => {
            if (code === 0) {
                res();
            }
            else {
                rej(new Error(`Command "${command}" exited with non-zero status code`));
            }
        });
        const exitHandler = (signal) => {
            if (cp && cp.pid && !cp.killed) {
                (0, tree_kill_1.default)(cp.pid, signal, (error) => {
                    // On Windows, tree-kill (which uses taskkill) may fail when the process or its child process is already terminated.
                    // Ignore the errors, otherwise we will log them unnecessarily.
                    if (error && process.platform !== 'win32') {
                        rej(error);
                    }
                    else {
                        res();
                    }
                });
            }
        };
        process.on('SIGINT', () => exitHandler('SIGINT'));
        process.on('SIGTERM', () => exitHandler('SIGTERM'));
        process.on('SIGHUP', () => exitHandler('SIGHUP'));
    });
}
async function ptyProcess(command, cwd, env) {
    const terminal = (0, pseudo_terminal_1.createPseudoTerminal)();
    await terminal.init();
    return new Promise((res, rej) => {
        let cp = terminal.runCommand(command, { cwd, jsEnv: env });
        cp.onExit((code) => {
            if (code === 0) {
                res();
            }
            else if (code >= 128) {
                process.exit(code);
            }
            else {
                rej();
            }
        });
    });
}
