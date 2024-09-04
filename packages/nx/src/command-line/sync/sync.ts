import * as ora from 'ora';
import { readNxJson } from '../../config/nx-json';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { output } from '../../utils/output';
import { handleErrors } from '../../utils/params';
import {
  collectAllRegisteredSyncGenerators,
  flushSyncGeneratorChanges,
  getFailedSyncGeneratorsFixMessageLines,
  getFlushFailureMessageLines,
  getSyncGeneratorChanges,
  getSyncGeneratorSuccessResultsMessageLines,
  processSyncGeneratorResultErrors,
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

    const {
      failedGeneratorsCount,
      areAllResultsFailures,
      anySyncGeneratorsFailed,
    } = processSyncGeneratorResultErrors(results);
    const failedSyncGeneratorsFixMessageLines =
      getFailedSyncGeneratorsFixMessageLines(results, options.verbose);

    if (areAllResultsFailures) {
      // if all sync generators failed to run we can't say for sure if the workspace is out of sync
      // because they could have failed due to a bug, so we print a warning and exit with code 0
      output.error({
        title: `The workspace is probably out of sync because ${
          failedGeneratorsCount === 1
            ? 'a sync generator'
            : 'some sync generators'
        } failed to run`,
        bodyLines: failedSyncGeneratorsFixMessageLines,
      });

      return 1;
    }

    const resultBodyLines = getSyncGeneratorSuccessResultsMessageLines(results);
    if (options.check) {
      output.error({
        title: 'The workspace is out of sync',
        bodyLines: resultBodyLines,
      });

      if (anySyncGeneratorsFailed) {
        output.error({
          title:
            failedGeneratorsCount === 1
              ? 'A sync generator failed to run'
              : 'Some sync generators failed to run',
          bodyLines: failedSyncGeneratorsFixMessageLines,
        });
      }

      return 1;
    }

    output.warn({
      title: 'The workspace is out of sync',
      bodyLines: resultBodyLines,
    });

    const spinner = ora('Syncing the workspace...');
    spinner.start();

    try {
      const flushResult = await flushSyncGeneratorChanges(results);

      if ('generatorFailures' in flushResult) {
        spinner.fail();
        output.error({
          title: 'Failed to sync the workspace',
          bodyLines: getFlushFailureMessageLines(flushResult, options.verbose),
        });

        return 1;
      }
    } catch (e) {
      spinner.fail();
      output.error({
        title: 'Failed to sync the workspace',
        bodyLines: [
          'Syncing the workspace failed with the following error:',
          '',
          e.message,
          ...(options.verbose && !!e.stack ? [`\n${e.stack}`] : []),
          '',
          'Please make sure to run with `--verbose` and report the error at: https://github.com/nrwl/nx/issues/new/choose',
        ],
      });

      return 1;
    }

    const successTitle = anySyncGeneratorsFailed
      ? // the identified changes were synced successfully, but the workspace
        // is still not up to date, which we'll mention next
        'The identified changes were synced successfully!'
      : // the workspace is fully up to date
        'The workspace was synced successfully!';
    const successSubtitle =
      'Please make sure to commit the changes to your repository.';
    spinner.succeed(`${successTitle}\n\n${successSubtitle}`);

    if (anySyncGeneratorsFailed) {
      output.error({
        title: `The workspace is probably still out of sync because ${
          failedGeneratorsCount === 1
            ? 'a sync generator'
            : 'some sync generators'
        } failed to run`,
        bodyLines: failedSyncGeneratorsFixMessageLines,
      });

      return 1;
    }

    return 0;
  });
}
