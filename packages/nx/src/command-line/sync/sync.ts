import * as ora from 'ora';
import { readNxJson } from '../../config/nx-json';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { output } from '../../utils/output';
import { handleErrors } from '../../utils/params';
import {
  collectAllRegisteredSyncGenerators,
  flushSyncGeneratorChanges,
  getSyncGeneratorChanges,
  syncGeneratorResultsToMessageLines,
} from '../../utils/sync-generators';
import type { SyncArgs } from './command-object';
import chalk = require('chalk');

interface SyncOptions extends SyncArgs {
  check?: boolean;
}

export function syncHandler(options: SyncOptions): Promise<number> {
  return handleErrors(options.verbose, async () => {
    const projectGraph = await createProjectGraphAsync();
    const nxJson = readNxJson();
    const syncGenerators = await collectAllRegisteredSyncGenerators(
      projectGraph,
      nxJson
    );

    if (!syncGenerators.length) {
      output.success({
        title: options.check
          ? 'The workspace is up to date'
          : 'The workspace is already up to date',
        bodyLines: ['There are no sync generators to run.'],
      });
      return 0;
    }

    const results = await getSyncGeneratorChanges(syncGenerators);

    if (!results.length) {
      output.success({
        title: options.check
          ? 'The workspace is up to date'
          : 'The workspace is already up to date',
        bodyLines: syncGenerators.map(
          (generator) =>
            `The ${chalk.bold(
              generator
            )} sync generator didn't identify any files in the workspace that are out of sync.`
        ),
      });
      return 0;
    }

    if (options.check) {
      output.error({
        title: `The workspace is out of sync`,
        bodyLines: syncGeneratorResultsToMessageLines(results),
      });

      return 1;
    }

    output.warn({
      title: `The workspace is out of sync`,
      bodyLines: syncGeneratorResultsToMessageLines(results),
    });

    const spinner = ora('Syncing the workspace...');
    spinner.start();

    await flushSyncGeneratorChanges(results);

    spinner.succeed(`The workspace was synced successfully!

Please make sure to commit the changes to your repository.
`);

    return 0;
  });
}
