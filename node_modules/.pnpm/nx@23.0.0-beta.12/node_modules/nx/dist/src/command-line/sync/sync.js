"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncHandler = syncHandler;
const tslib_1 = require("tslib");
const nx_json_1 = require("../../config/nx-json");
const project_graph_1 = require("../../project-graph/project-graph");
const output_1 = require("../../utils/output");
const handle_errors_1 = require("../../utils/handle-errors");
const sync_generators_1 = require("../../utils/sync-generators");
const pc = tslib_1.__importStar(require("picocolors"));
const spinner_1 = require("../../utils/spinner");
function syncHandler(options) {
    return (0, handle_errors_1.handleErrors)(options.verbose, async () => {
        const projectGraph = await (0, project_graph_1.createProjectGraphAsync)();
        const nxJson = (0, nx_json_1.readNxJson)();
        const { globalGenerators, taskGenerators } = await (0, sync_generators_1.collectAllRegisteredSyncGenerators)(projectGraph, nxJson);
        if (!globalGenerators.length && !taskGenerators.length) {
            output_1.output.success({
                title: options.check
                    ? 'The workspace is up to date'
                    : 'The workspace is already up to date',
                bodyLines: ['There are no sync generators to run.'],
            });
            return 0;
        }
        const syncGenerators = Array.from(new Set([...globalGenerators, ...taskGenerators]));
        const results = await (0, sync_generators_1.getSyncGeneratorChanges)(syncGenerators);
        if (!results.length) {
            output_1.output.success({
                title: options.check
                    ? 'The workspace is up to date'
                    : 'The workspace is already up to date',
                bodyLines: syncGenerators.map((generator) => `[${pc.bold(generator)}]: All files are up to date.`),
            });
            return 0;
        }
        const { failedGeneratorsCount, areAllResultsFailures, anySyncGeneratorsFailed, } = (0, sync_generators_1.processSyncGeneratorResultErrors)(results);
        const failedSyncGeneratorsFixMessageLines = (0, sync_generators_1.getFailedSyncGeneratorsFixMessageLines)(results, options.verbose, new Set(globalGenerators));
        if (areAllResultsFailures) {
            output_1.output.error({
                title: `The workspace is probably out of sync because ${failedGeneratorsCount === 1
                    ? 'a sync generator'
                    : 'some sync generators'} failed to run`,
                bodyLines: failedSyncGeneratorsFixMessageLines,
            });
            return 1;
        }
        const resultBodyLines = (0, sync_generators_1.getSyncGeneratorSuccessResultsMessageLines)(results, 
        // log the out of sync details if the user is running `nx sync --check`
        options.check);
        if (options.check) {
            output_1.output.error({
                title: 'The workspace is out of sync',
                bodyLines: [
                    ...resultBodyLines,
                    '',
                    'Run `nx sync` to sync the workspace.',
                ],
            });
            if (anySyncGeneratorsFailed) {
                output_1.output.error({
                    title: failedGeneratorsCount === 1
                        ? 'A sync generator failed to run'
                        : 'Some sync generators failed to run',
                    bodyLines: failedSyncGeneratorsFixMessageLines,
                });
            }
            return 1;
        }
        output_1.output.warn({
            title: 'The workspace is out of sync',
            bodyLines: resultBodyLines,
        });
        const spinner = spinner_1.globalSpinner.start('Syncing the workspace...');
        try {
            const flushResult = await (0, sync_generators_1.flushSyncGeneratorChanges)(results);
            if ('generatorFailures' in flushResult) {
                spinner.fail();
                output_1.output.error({
                    title: 'Failed to sync the workspace',
                    bodyLines: (0, sync_generators_1.getFlushFailureMessageLines)(flushResult, options.verbose, new Set(globalGenerators)),
                });
                return 1;
            }
        }
        catch (e) {
            spinner.fail();
            output_1.output.error({
                title: 'Failed to sync the workspace',
                bodyLines: [
                    'Syncing the workspace failed with the following error:',
                    '',
                    e.message,
                    ...(!!e.stack ? [`\n${e.stack}`] : []),
                    '',
                    'Please report the error at: https://github.com/nrwl/nx/issues/new/choose',
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
        const successSubtitle = 'Please make sure to commit the changes to your repository.';
        spinner.succeed(`${successTitle}\n\n${successSubtitle}`);
        if (anySyncGeneratorsFailed) {
            output_1.output.error({
                title: `The workspace is probably still out of sync because ${failedGeneratorsCount === 1
                    ? 'a sync generator'
                    : 'some sync generators'} failed to run`,
                bodyLines: failedSyncGeneratorsFixMessageLines,
            });
            return 1;
        }
        return 0;
    });
}
