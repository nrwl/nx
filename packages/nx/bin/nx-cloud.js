#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.invokeCommandWithNxCloudClient = invokeCommandWithNxCloudClient;
const get_cloud_options_js_1 = require('../src/nx-cloud/utilities/get-cloud-options.js');
const update_manager_js_1 = require('../src/nx-cloud/update-manager.js');
const output_js_1 = require('../src/utils/output.js');
const client_js_1 = require('../src/nx-cloud/utilities/client.js');
const command = process.argv[2];
const options = (0, get_cloud_options_js_1.getCloudOptions)();
Promise.resolve().then(async () => invokeCommandWithNxCloudClient(options));
async function invokeCommandWithNxCloudClient(options) {
  try {
    const client = await (0, client_js_1.getCloudClient)(options);
    client.invoke(command);
  } catch (e) {
    if (e instanceof client_js_1.UnknownCommandError) {
      output_js_1.output.error({
        title: `Unknown Command "${e.command}"`,
      });
      output_js_1.output.log({
        title: 'Available Commands:',
        bodyLines: e.availableCommands.map((c) => `- ${c}`),
      });
      process.exit(1);
    }
    const body = ['Cannot run commands from the `nx-cloud` CLI.'];
    if (e instanceof update_manager_js_1.NxCloudEnterpriseOutdatedError) {
      try {
        // TODO: Remove this when all enterprise customers have updated.
        // Try requiring the bin from the `nx-cloud` package.
        return require('nx-cloud/bin/nx-cloud');
      } catch {}
      body.push(
        'If you are an Nx Enterprise customer, please reach out to your assigned Developer Productivity Engineer.',
        'If you are NOT an Nx Enterprise customer but are seeing this message, please reach out to cloud-support@nrwl.io.'
      );
    }
    if (e instanceof update_manager_js_1.NxCloudClientUnavailableError) {
      body.unshift(
        'You may be offline. Please try again when you are back online.'
      );
    }
    output_js_1.output.error({
      title: e.message,
      bodyLines: body,
    });
    process.exit(1);
  }
}
