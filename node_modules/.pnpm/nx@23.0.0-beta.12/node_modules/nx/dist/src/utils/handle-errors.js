"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleErrors = handleErrors;
const logger_1 = require("./logger");
const output_1 = require("./output");
const handle_import_1 = require("./handle-import");
async function handleErrors(isVerbose, fn) {
    try {
        const result = await fn();
        if (typeof result === 'number') {
            return result;
        }
        return 0;
    }
    catch (err) {
        err ||= new Error('Unknown error caught');
        if (err.constructor.name === 'UnsuccessfulWorkflowExecution') {
            logger_1.logger.error('The generator workflow failed. See above.');
        }
        else if (err.name === 'ProjectGraphError') {
            const projectGraphError = err;
            let title = projectGraphError.message;
            if (projectGraphError.cause &&
                typeof projectGraphError.cause === 'object' &&
                'message' in projectGraphError.cause) {
                title += ' ' + projectGraphError.cause.message + '.';
            }
            output_1.output.error({
                title,
                bodyLines: isVerbose
                    ? formatErrorStackAndCause(projectGraphError, isVerbose)
                    : projectGraphError.getErrors().map((e) => e.message),
            });
        }
        else if (err.name === 'ProjectConfigurationsError') {
            const projectConfigurationsError = err;
            let title = projectConfigurationsError.message;
            if (projectConfigurationsError.cause &&
                typeof projectConfigurationsError.cause === 'object' &&
                'message' in projectConfigurationsError.cause) {
                title += ' ' + projectConfigurationsError.cause.message + '.';
            }
            output_1.output.error({
                title,
                bodyLines: isVerbose
                    ? formatErrorStackAndCause(projectConfigurationsError, isVerbose)
                    : projectConfigurationsError.errors.map((e) => e.message),
            });
        }
        else {
            const lines = (err.message ? err.message : err.toString()).split('\n');
            const bodyLines = lines.slice(1);
            if (isVerbose) {
                bodyLines.push(...formatErrorStackAndCause(err, isVerbose));
            }
            else if (err.stack) {
                bodyLines.push('Pass --verbose to see the stacktrace.');
            }
            output_1.output.error({
                title: lines[0],
                bodyLines,
            });
        }
        const { daemonClient } = await (0, handle_import_1.handleImport)(require.resolve('../daemon/client/client'));
        if (daemonClient.enabled()) {
            daemonClient.reset();
        }
        return 1;
    }
}
function formatErrorStackAndCause(error, verbose) {
    return [
        verbose ? error.stack || error.message : error.message,
        ...(error.cause && typeof error.cause === 'object'
            ? [
                'Caused by:',
                verbose && 'stack' in error.cause
                    ? error.cause.stack.toString()
                    : error.cause.toString(),
            ]
            : []),
    ];
}
