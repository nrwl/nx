"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordHandler = recordHandler;
const child_process_1 = require("child_process");
const nx_json_1 = require("../../../config/nx-json");
const output_1 = require("../../../utils/output");
const nx_cloud_utils_1 = require("../../../utils/nx-cloud-utils");
const utils_1 = require("../utils");
function recordHandler(args) {
    if (!(0, nx_cloud_utils_1.isNxCloudUsed)((0, nx_json_1.readNxJson)())) {
        let exitCode = 0;
        const commandArgs = args['--'];
        if (commandArgs && commandArgs.length > 0) {
            const [cmd, ...cmdArgs] = commandArgs;
            const result = (0, child_process_1.spawnSync)(cmd, cmdArgs, {
                stdio: 'inherit',
                shell: true,
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                windowsHide: true,
            });
            exitCode = result.status ?? 1;
        }
        output_1.output.warn({
            title: 'Nx Cloud is not enabled',
            bodyLines: [
                'To record command using Nx Cloud, connect your workspace with `nx connect`.',
            ],
        });
        return Promise.resolve(exitCode);
    }
    return (0, utils_1.executeNxCloudCommand)('record', args.verbose);
}
