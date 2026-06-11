"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPreTasksExecution = runPreTasksExecution;
exports.runPostTasksExecution = runPostTasksExecution;
const nx_json_1 = require("../../config/nx-json");
const get_plugins_1 = require("./get-plugins");
const is_on_daemon_1 = require("../../daemon/is-on-daemon");
const client_1 = require("../../daemon/client/client");
const workspace_root_1 = require("../../utils/workspace-root");
async function runPreTasksExecution(pluginContext) {
    if ((0, is_on_daemon_1.isOnDaemon)() || !(0, client_1.isDaemonEnabled)()) {
        performance.mark(`preTasksExecution:start`);
        const plugins = await (0, get_plugins_1.getPlugins)((0, nx_json_1.readNxJson)(pluginContext.workspaceRoot), pluginContext.workspaceRoot);
        const envs = await Promise.all(plugins
            .filter((p) => p.preTasksExecution)
            .map(async (plugin) => {
            performance.mark(`${plugin.name}:preTasksExecution:start`);
            try {
                return await plugin.preTasksExecution(pluginContext);
            }
            finally {
                performance.mark(`${plugin.name}:preTasksExecution:end`);
                performance.measure(`${plugin.name}:preTasksExecution`, `${plugin.name}:preTasksExecution:start`, `${plugin.name}:preTasksExecution:end`);
            }
        }));
        if (!(0, client_1.isDaemonEnabled)()) {
            applyProcessEnvs(envs);
        }
        performance.mark(`preTasksExecution:end`);
        performance.measure(`preTasksExecution`, `preTasksExecution:start`, `preTasksExecution:end`);
        return envs;
    }
    else {
        const envs = await client_1.daemonClient.runPreTasksExecution(pluginContext);
        applyProcessEnvs(envs);
    }
}
function applyProcessEnvs(envs) {
    for (const env of envs) {
        for (const key in env) {
            process.env[key] = env[key];
        }
    }
}
async function runPostTasksExecution(context) {
    if ((0, is_on_daemon_1.isOnDaemon)() || !(0, client_1.isDaemonEnabled)()) {
        performance.mark(`postTasksExecution:start`);
        const plugins = await (0, get_plugins_1.getPlugins)((0, nx_json_1.readNxJson)(workspace_root_1.workspaceRoot));
        await Promise.all(plugins
            .filter((p) => p.postTasksExecution)
            .map(async (plugin) => {
            performance.mark(`${plugin.name}:postTasksExecution:start`);
            try {
                await plugin.postTasksExecution(context);
            }
            finally {
                performance.mark(`${plugin.name}:postTasksExecution:end`);
                performance.measure(`${plugin.name}:postTasksExecution`, `${plugin.name}:postTasksExecution:start`, `${plugin.name}:postTasksExecution:end`);
            }
        }));
        performance.mark(`postTasksExecution:end`);
        performance.measure(`postTasksExecution`, `postTasksExecution:start`, `postTasksExecution:end`);
    }
    else {
        await client_1.daemonClient.runPostTasksExecution(context);
    }
}
