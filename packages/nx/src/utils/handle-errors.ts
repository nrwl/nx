import { daemonClient } from '../daemon/client/client';
import { ProjectGraphError } from '../project-graph/error-types';
import { logger } from './logger';
import { output } from './output';

export async function handleErrors(
  isVerbose: boolean,
  fn: Function
): Promise<number> {
  try {
    const result = await fn();
    if (typeof result === 'number') {
      return result;
    }
    return 0;
  } catch (err) {
    err ||= new Error('Unknown error caught');
    if (err.constructor.name === 'UnsuccessfulWorkflowExecution') {
      logger.error('The generator workflow failed. See above.');
    } else if (err.name === 'ProjectGraphError') {
      const projectGraphError = err as ProjectGraphError;
      let title = projectGraphError.message;
      if (
        projectGraphError.cause &&
        typeof projectGraphError.cause === 'object' &&
        'message' in projectGraphError.cause
      ) {
        title += ' ' + projectGraphError.cause.message + '.';
      }
      if (isVerbose) {
        title += ' See errors below.';
      }

      const bodyLines = isVerbose
        ? formatErrorStackAndCause(projectGraphError)
        : ['Pass --verbose to see the stacktraces.'];

      output.error({
        title,
        bodyLines: bodyLines,
      });
    } else {
      const lines = (err.message ? err.message : err.toString()).split('\n');
      const bodyLines: string[] = lines.slice(1);
      if (isVerbose) {
        bodyLines.push(...formatErrorStackAndCause(err));
      } else if (err.stack) {
        bodyLines.push('Pass --verbose to see the stacktrace.');
      }
      output.error({
        title: lines[0],
        bodyLines,
      });
    }
    if (daemonClient.enabled()) {
      daemonClient.reset();
    }
    return 1;
  }
}

function formatErrorStackAndCause<T extends Error>(error: T): string[] {
  return [
    error.stack || error.message,
    ...(error.cause && typeof error.cause === 'object'
      ? [
          'Caused by:',
          'stack' in error.cause
            ? error.cause.stack.toString()
            : error.cause.toString(),
        ]
      : []),
  ];
}
