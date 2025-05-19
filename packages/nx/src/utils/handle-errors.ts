import type {
  ProjectConfigurationsError,
  ProjectGraphError,
} from '../project-graph/error-types';
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

      output.error({
        title,
        bodyLines: isVerbose
          ? formatErrorStackAndCause(projectGraphError, isVerbose)
          : projectGraphError.getErrors().map((e) => e.message),
      });
    } else if (err.name === 'ProjectConfigurationsError') {
      const projectConfigurationsError = err as ProjectConfigurationsError;
      let title = projectConfigurationsError.message;
      if (
        projectConfigurationsError.cause &&
        typeof projectConfigurationsError.cause === 'object' &&
        'message' in projectConfigurationsError.cause
      ) {
        title += ' ' + projectConfigurationsError.cause.message + '.';
      }

      output.error({
        title,
        bodyLines: isVerbose
          ? formatErrorStackAndCause(projectConfigurationsError, isVerbose)
          : projectConfigurationsError.errors.map((e) => e.message),
      });
    } else {
      const lines = (err.message ? err.message : err.toString()).split('\n');
      const bodyLines: string[] = lines.slice(1);
      if (isVerbose) {
        bodyLines.push(...formatErrorStackAndCause(err, isVerbose));
      } else if (err.stack) {
        bodyLines.push('Pass --verbose to see the stacktrace.');
      }
      output.error({
        title: lines[0],
        bodyLines,
      });
    }
    const { daemonClient } = await import('../daemon/client/client');
    if (daemonClient.enabled()) {
      daemonClient.reset();
    }
    return 1;
  }
}

function formatErrorStackAndCause<T extends Error>(
  error: T,
  verbose: boolean
): string[] {
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
