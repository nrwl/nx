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
  flushTelemetry,
  otelContext,
  type Span,
  type Context,
} from './telemetry';

// Current command span for telemetry
let currentCommandSpan: Span | null = null;
// Current command context for telemetry (ensures child spans are connected)
let currentCommandContext: Context | null = null;
// Store the command name separately for error recording
let currentCommandName: string | null = null;

/**
 * Start recording a command for telemetry.
 * Call this before handleErrors to associate the command with telemetry.
 */
export function startCommandRecording(command: string, argv: string[]): void {
  const result = recordCommandStart(command, argv);
  if (result) {
    currentCommandSpan = result.span;
    currentCommandContext = result.ctx;
  }
  currentCommandName = command;
}

/**
 * Get the current command being executed (for error recording).
 */
export function getCurrentCommand(): string {
  return currentCommandName ?? 'unknown';
}

export async function handleErrors(
  isVerbose: boolean,
  fn: Function
): Promise<number> {
  // Inner function that contains the actual logic
  const runFn = async (): Promise<number> => {
    try {
      const result = await fn();
      // Record successful command completion
      if (currentCommandSpan) {
        recordCommandEnd(currentCommandSpan, true);
        currentCommandSpan = null;
        currentCommandContext = null;
        currentCommandName = null;
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
      if (currentCommandSpan) {
        recordError(err, 'command-execution', currentCommandName ?? 'unknown');
        recordCommandEnd(currentCommandSpan, false);
        currentCommandSpan = null;
        currentCommandContext = null;
        currentCommandName = null;
      }

      const { daemonClient } = await import('../daemon/client/client');
      if (daemonClient.enabled()) {
        daemonClient.reset();
      }
      return 1;
    } finally {
      await flushTelemetry();
    }
  };

  // Execute within the command's context if available so child spans are connected
  if (currentCommandContext) {
    return otelContext.with(currentCommandContext, runFn);
  }
  return runFn();
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
