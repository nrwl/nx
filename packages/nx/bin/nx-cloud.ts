#!/usr/bin/env node

import { findAncestorNodeModules } from '../src/nx-cloud/resolution-helpers';
import { getCloudOptions } from '../src/nx-cloud/utilities/get-cloud-options';
import {
  NxCloudClientUnavailableError,
  NxCloudEnterpriseOutdatedError,
  verifyOrUpdateNxCloudClient,
} from '../src/nx-cloud/update-manager';
import type { CloudTaskRunnerOptions } from '../src/nx-cloud/nx-cloud-tasks-runner-shell';
import { output } from '../src/utils/output';

const command = process.argv[2];

const options = getCloudOptions();

Promise.resolve().then(async () => invokeCommandWithNxCloudClient(options));

async function invokeCommandWithNxCloudClient(options: CloudTaskRunnerOptions) {
  try {
    const { nxCloudClient } = await verifyOrUpdateNxCloudClient(options);

    const paths = findAncestorNodeModules(__dirname, []);
    nxCloudClient.configureLightClientRequire()(paths);

    if (command in nxCloudClient.commands) {
      nxCloudClient.commands[command]()
        .then(() => process.exit(0))
        .catch((e) => {
          console.error(e);
          process.exit(1);
        });
    } else {
      output.error({
        title: `Unknown Command "${command}"`,
      });
      output.log({
        title: 'Available Commands:',
        bodyLines: Object.keys(nxCloudClient.commands).map((c) => `- ${c}`),
      });
      process.exit(1);
    }
  } catch (e: any) {
    const body = ['Cannot run commands from the `nx-cloud` CLI.'];

    if (e instanceof NxCloudEnterpriseOutdatedError) {
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

    if (e instanceof NxCloudClientUnavailableError) {
      body.unshift(
        'You may be offline. Please try again when you are back online.'
      );
    }

    output.error({
      title: e.message,
      bodyLines: body,
    });
    process.exit(1);
  }
}
