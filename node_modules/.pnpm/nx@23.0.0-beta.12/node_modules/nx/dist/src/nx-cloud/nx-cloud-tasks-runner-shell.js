"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nxCloudTasksRunnerShell = void 0;
const default_tasks_runner_1 = require("../tasks-runner/default-tasks-runner");
const output_1 = require("../utils/output");
const resolution_helpers_1 = require("./resolution-helpers");
const update_manager_1 = require("./update-manager");
const nxCloudTasksRunnerShell = async (tasks, options, context) => {
    try {
        const { nxCloudClient, version } = await (0, update_manager_1.verifyOrUpdateNxCloudClient)(options);
        options.clientVersion = version;
        const paths = (0, resolution_helpers_1.findAncestorNodeModules)(__dirname, []);
        nxCloudClient.configureLightClientRequire()(paths);
        return nxCloudClient.nxCloudTasksRunner(tasks, options, context);
    }
    catch (e) {
        const body = e instanceof update_manager_1.NxCloudEnterpriseOutdatedError
            ? [
                'If you are an Nx Enterprise customer, please reach out to your assigned Developer Productivity Engineer.',
                'If you are NOT an Nx Enterprise customer but are seeing this message, please reach out to cloud-support@nrwl.io.',
            ]
            : e instanceof update_manager_1.NxCloudClientUnavailableError
                ? [
                    'You might be offline. Nx Cloud will be re-enabled when you are back online.',
                ]
                : [];
        if (e instanceof update_manager_1.NxCloudEnterpriseOutdatedError) {
            output_1.output.warn({
                title: e.message,
                bodyLines: ['Nx Cloud will not be used for this command.', ...body],
            });
        }
        const results = await (0, default_tasks_runner_1.defaultTasksRunner)(tasks, options, context);
        output_1.output.warn({
            title: e.message,
            bodyLines: ['Nx Cloud was not used for this command.', ...body],
        });
        return results;
    }
};
exports.nxCloudTasksRunnerShell = nxCloudTasksRunnerShell;
