import type {
  ProjectConfigurationsError,
  ProjectGraphError,
} from '../project-graph/error-types';
import { logger } from './logger';
import { output } from './output';
import {
  recordCommandStart,
  recordCommandEnd,
  recordError,
  type CommandContext,
} from './telemetry';

// Current command context for telemetry
let currentCommandContext: CommandContext | null = null;

/**
 * Start recording a command for telemetry.
 * Call this before handleErrors to associate the command with telemetry.
 */
export function startCommandRecording(command: string, argv: string[]): void {
  currentCommandContext = recordCommandStart(command, argv);
}

/**
 * Get the current command being executed (for error recording).
 */
export function getCurrentCommand(): string {
  return currentCommandContext?.command ?? 'unknown';
}

export async function handleErrors(
  isVerbose: boolean,
  fn: Function
): Promise<number> {
  try {
    const result = await fn();
    // Record successful command completion
    if (currentCommandContext) {
      recordCommandEnd(currentCommandContext, true);
      currentCommandContext = null;
    }
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
    // Record failed command completion and error
    if (currentCommandContext) {
      recordError(err, 'command-execution', currentCommandContext.command);
      recordCommandEnd(currentCommandContext, false);
      currentCommandContext = null;
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
