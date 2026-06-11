"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PseudoTtyProcess = void 0;
exports.getRunNxBaseCommand = getRunNxBaseCommand;
exports.runNxSync = runNxSync;
exports.runNxAsync = runNxAsync;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const package_manager_1 = require("./package-manager");
const workspace_root_1 = require("./workspace-root");
const exit_codes_1 = require("./exit-codes");
function getRunNxBaseCommand(packageManagerCommand, cwd = process.cwd()) {
    if ((0, fs_1.existsSync)((0, path_1.join)(workspace_root_1.workspaceRoot, 'package.json'))) {
        if (!packageManagerCommand) {
            const pm = (0, package_manager_1.detectPackageManager)(workspace_root_1.workspaceRoot);
            packageManagerCommand = (0, package_manager_1.getPackageManagerCommand)(pm, workspace_root_1.workspaceRoot);
        }
        return `${packageManagerCommand.exec} nx`;
    }
    else {
        const offsetFromRoot = (0, path_1.relative)(cwd, (0, workspace_root_1.workspaceRootInner)(cwd, null));
        if (process.platform === 'win32') {
            return '.\\' + (0, path_1.join)(`${offsetFromRoot}`, 'nx.bat');
        }
        else {
            return './' + (0, path_1.join)(`${offsetFromRoot}`, 'nx');
        }
    }
}
function runNxSync(cmd, options) {
    let { packageManagerCommand, ...execSyncOptions } = options ?? {};
    execSyncOptions.cwd ??= process.cwd();
    execSyncOptions.windowsHide ??= true;
    const baseCmd = getRunNxBaseCommand(packageManagerCommand, execSyncOptions.cwd);
    (0, child_process_1.execSync)(`${baseCmd} ${cmd}`, execSyncOptions);
}
async function runNxAsync(cmd, options) {
    options ??= {};
    options.cwd ??= process.cwd();
    let { silent, packageManagerCommand, ...execSyncOptions } = options;
    silent ??= true;
    const baseCmd = getRunNxBaseCommand(packageManagerCommand, execSyncOptions.cwd);
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.exec)(`${baseCmd} ${cmd}`, { ...execSyncOptions, windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || stdout || error.message);
            }
            else {
                resolve();
            }
        });
        if (!silent) {
            child.stdout?.pipe(process.stdout);
            child.stderr?.pipe(process.stderr);
        }
    });
}
class PseudoTtyProcess {
    constructor(childProcess) {
        this.childProcess = childProcess;
        this.isAlive = true;
        this.exitCallbacks = [];
        childProcess.onExit((message) => {
            this.isAlive = false;
            const exitCode = (0, exit_codes_1.messageToCode)(message);
            this.exitCallbacks.forEach((cb) => cb(exitCode));
        });
    }
    onExit(callback) {
        this.exitCallbacks.push(callback);
    }
    onOutput(callback) {
        this.childProcess.onOutput(callback);
    }
    kill() {
        try {
            this.childProcess.kill();
        }
        catch {
            // when the child process completes before we explicitly call kill, this will throw
            // do nothing
        }
        finally {
            if (this.isAlive == true) {
                this.isAlive = false;
            }
        }
    }
}
exports.PseudoTtyProcess = PseudoTtyProcess;
