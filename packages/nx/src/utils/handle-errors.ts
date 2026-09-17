import {
  formatProjectGraphError,
  type ProjectConfigurationsError,
  type ProjectGraphError,
} from '../project-graph/error-types';
import { logger } from './logger';
import { output } from './output';
import { handleImport } from './handle-import';

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
    } else if (
      err.name === 'ProjectGraphError' ||
      err.name === 'ProjectConfigurationsError'
    ) {
      output.error(
        formatProjectGraphError(
          err as ProjectGraphError | ProjectConfigurationsError,
          isVerbose
        )
      );
    } else if (err.name === 'MinReleaseAgeViolationError') {
      // A cooldown violation already carries a user-shaped headline plus
      // actionable remediation; surface the remediation rather than a stack.
      output.error({
        title: err.message,
        bodyLines: Array.isArray(err.remediation) ? err.remediation : [],
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
    const { daemonClient } = await handleImport(
      require.resolve('../daemon/client/client')
    );
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
