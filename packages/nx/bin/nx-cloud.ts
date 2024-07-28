#!/usr/bin/env node

import { getCloudOptions } from '../src/nx-cloud/utilities/get-cloud-options';
import {
  NxCloudClientUnavailableError,
  NxCloudEnterpriseOutdatedError,
} from '../src/nx-cloud/update-manager';
import type { CloudTaskRunnerOptions } from '../src/nx-cloud/nx-cloud-tasks-runner-shell';
import { output } from '../src/utils/output';
import {
  UnknownCommandError,
  getCloudClient,
} from '../src/nx-cloud/utilities/client';

const command = process.argv[2];

const options = getCloudOptions();

Promise.resolve().then(async () => invokeCommandWithNxCloudClient(options));

export async function invokeCommandWithNxCloudClient(
  options: CloudTaskRunnerOptions
) {
  try {
    const client = await getCloudClient(options);
    client.invoke(command);
  } catch (e: any) {
    if (e instanceof UnknownCommandError) {
      output.error({
        title: `Unknown Command "${e.command}"`,
      });
      output.log({
        title: 'Available Commands:',
        bodyLines: e.availableCommands.map((c) => `- ${c}`),
      });
      process.exit(1);
    }
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
