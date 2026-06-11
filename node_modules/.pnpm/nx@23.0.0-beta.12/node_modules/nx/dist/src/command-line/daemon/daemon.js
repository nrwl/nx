"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.daemonHandler = daemonHandler;
const cache_1 = require("../../daemon/cache");
const tmp_dir_1 = require("../../daemon/tmp-dir");
const handle_import_1 = require("../../utils/handle-import");
const output_1 = require("../../utils/output");
async function daemonHandler(args) {
    const { daemonClient } = await (0, handle_import_1.handleImport)('../../daemon/client/client.js', __dirname);
    if (args.start) {
        const pid = await daemonClient.startInBackground();
        output_1.output.log({
            title: `Daemon Server - Started in a background process...`,
            bodyLines: [
                `${output_1.output.dim('Logs from the Daemon process (')}ID: ${pid}${output_1.output.dim(') can be found here:')} ${tmp_dir_1.DAEMON_OUTPUT_LOG_FILE}\n`,
            ],
        });
    }
    else if (args.stop) {
        await daemonClient.stop();
        output_1.output.log({ title: 'Daemon Server - Stopped' });
    }
    else if (await daemonClient.isServerAvailable()) {
        const pid = (0, cache_1.getDaemonProcessIdSync)();
        console.log(`Nx Daemon is currently running:
  - Logs: ${tmp_dir_1.DAEMON_OUTPUT_LOG_FILE}${pid ? `\n  - Process ID: ${pid}` : ''}`);
    }
    else {
        console.log('Nx Daemon is not running.');
    }
}
