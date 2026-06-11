"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpHandler = mcpHandler;
exports.showHelp = showHelp;
const child_process_1 = require("child_process");
const package_manager_1 = require("../../utils/package-manager");
const workspace_root_1 = require("../../utils/workspace-root");
async function mcpHandler(args) {
    const packageManager = (0, package_manager_1.detectPackageManager)();
    const packageManagerCommands = (0, package_manager_1.getPackageManagerCommand)(packageManager);
    const passthroughArgs = args['_'][0] === 'mcp' ? args['_'].slice(1) : args['_'];
    let dlxArgs;
    if (packageManager === 'npm') {
        dlxArgs = ['-y', 'nx-mcp@latest', ...passthroughArgs];
    }
    else if (packageManager === 'yarn') {
        dlxArgs = ['--quiet', 'nx-mcp@latest', ...passthroughArgs];
    }
    else if (packageManager === 'bun') {
        dlxArgs = ['--silent', 'nx-mcp@latest', ...passthroughArgs];
    }
    else {
        dlxArgs = ['nx-mcp@latest', ...passthroughArgs];
    }
    // For commands that might contain spaces like "pnpm dlx"
    const dlxCommand = packageManagerCommands.dlx.split(' ');
    const executable = dlxCommand[0];
    const execArgs = [...dlxCommand.slice(1), ...dlxArgs];
    (0, child_process_1.spawnSync)(executable, execArgs, {
        stdio: 'inherit',
        cwd: workspace_root_1.workspaceRoot,
        windowsHide: true,
    });
}
async function showHelp() {
    const packageManager = (0, package_manager_1.detectPackageManager)();
    const packageManagerCommands = (0, package_manager_1.getPackageManagerCommand)(packageManager);
    let dlxArgs;
    if (packageManager === 'npm') {
        dlxArgs = ['-y', 'nx-mcp@latest', '--help'];
    }
    else if (packageManager === 'yarn') {
        dlxArgs = ['--quiet', 'nx-mcp@latest', '--help'];
    }
    else if (packageManager === 'bun') {
        dlxArgs = ['--silent', 'nx-mcp@latest', '--help'];
    }
    else {
        dlxArgs = ['nx-mcp@latest', '--help'];
    }
    const dlxCommand = packageManagerCommands.dlx.split(' ');
    const executable = dlxCommand[0];
    const execArgs = [...dlxCommand.slice(1), ...dlxArgs];
    const helpOutput = (0, child_process_1.spawnSync)(executable, execArgs, {
        cwd: workspace_root_1.workspaceRoot,
        encoding: 'utf-8',
        windowsHide: true,
    });
    console.log(helpOutput.stdout?.toString().replaceAll('nx-mcp', 'nx mcp'));
}
