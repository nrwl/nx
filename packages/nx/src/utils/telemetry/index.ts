/**
 * Telemetry module for Nx anonymous usage data collection.
 *
 * This module provides:
 * - Settings resolution from multiple sources (env, repo, user)
 * - User preferences storage in ~/.nxrc
 * - Opt-in prompt for interactive sessions
 */

// Types
export type {
  TelemetrySettings,
  ResolvedTelemetrySettings,
  SanitizedArgs,
  SanitizedValue,
  WorkspaceMetadata,
  CommandTelemetryEvent,
  TaskExecutionEvent,
  ErrorEvent,
  CommandContext,
} from './types';

// Settings resolution
export {
  resolveTelemetrySettings,
  isTelemetryEnabled,
  getTelemetryEndpoints,
  shouldPromptForTelemetry,
  clearSettingsCache,
} from './resolve-settings';

// User settings
export {
  getUserTelemetrySettings,
  setUserTelemetrySettings,
  hasUserTelemetryPreference,
  getNxrcPath,
} from './user-settings';

// Prompt
export { promptForTelemetryIfNeeded } from './prompt';

// Sanitization
export {
  sanitizeArgs,
  sanitizeValue,
  sanitizeTarget,
  sanitizeConfiguration,
  sanitizeGeneratorName,
  sanitizeErrorMessage,
  sanitizeStackTrace,
  anonymizeProjectName,
  resetProjectNameMap,
  isKnownPlugin,
} from './sanitize';

import { performance } from 'perf_hooks';
import {
  sanitizeArgs,
  sanitizeTarget,
  anonymizeProjectName,
  sanitizeErrorMessage,
  sanitizeStackTrace,
} from './sanitize';
import {
  initWorker,
  sendSpans,
  flush,
  shutdown,
  isWorkerInitialized,
  getAiFixId,
} from './exporter';
import type { SerializedSpan, SerializedAttribute } from './worker-types';
import type { CommandContext } from './types';

// Re-export types that consumers might need
export type { SerializedSpan, SerializedAttribute } from './worker-types';

let isInitialized = false;
let currentTraceId: string | null = null;

/**
 * Generate a random hex string of specified length.
 */
function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Generate a trace ID (32 hex characters).
 */
function generateTraceId(): string {
  return randomHex(32);
}

/**
 * Generate a span ID (16 hex characters).
 */
function generateSpanId(): string {
  return randomHex(16);
}

/**
 * Convert a value to the serialized attribute format.
 */
function serializeAttributeValue(value: unknown): SerializedAttribute['value'] {
  if (typeof value === 'string') {
    return { stringValue: value };
  } else if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { intValue: String(value) };
    } else {
      return { doubleValue: String(value) };
    }
  } else if (typeof value === 'boolean') {
    return { boolValue: value };
  } else if (Array.isArray(value)) {
    return { stringValue: JSON.stringify(value) };
  } else {
    return { stringValue: String(value) };
  }
}

/**
 * Convert an object to serialized attributes array.
 */
function toAttributes(obj: Record<string, unknown>): SerializedAttribute[] {
  return Object.entries(obj).map(([key, value]) => ({
    key,
    value: serializeAttributeValue(value),
  }));
}

/**
 * Convert high-resolution time to nanoseconds string.
 */
function hrTimeToNano(hrTime: [number, number]): string {
  const nanos = BigInt(hrTime[0]) * BigInt(1e9) + BigInt(hrTime[1]);
  return nanos.toString();
}

/**
 * Get current time as nanoseconds string.
 */
function nowNano(): string {
  const now = performance.timeOrigin + performance.now();
  const seconds = Math.floor(now / 1000);
  const nanoseconds = Math.round((now % 1000) * 1e6);
  return hrTimeToNano([seconds, nanoseconds]);
}

/**
 * Check if telemetry is enabled.
 * TODO: This will be replaced with actual settings resolution from Phase 1/2.
 */
function isTelemetryEnabled(): boolean {
  // Placeholder - will be replaced with actual implementation
  // For now, check if NX_CLOUD_ACCESS_TOKEN is set
  return true; // !!process.env.NX_CLOUD_ACCESS_TOKEN;
}

/**
 * Initialize telemetry for the current Nx session.
 * Should be called early in the Nx process lifecycle.
 *
 * @param workspaceRoot The workspace root path, or null if not in a workspace
 */
export async function initTelemetry(
  workspaceRoot: string | null
): Promise<void> {
  if (isInitialized) {
    return;
  }

  // TODO: Replace with actual isTelemetryEnabled() check
  // if (!isTelemetryEnabled()) {
  if (!isTelemetryEnabled()) {
    return;
  }

  await initWorker();
  isInitialized = true;
  currentTraceId = generateTraceId();
}

/**
 * Record the start of a command execution.
 * Returns a context object that should be passed to recordCommandEnd.
 *
 * @param command The command name (e.g., 'build', 'test', 'run')
 * @param argv The command arguments (will be sanitized)
 */
export function recordCommandStart(
  command: string,
  argv: string[]
): CommandContext {
  return {
    command,
    startTime: performance.now(),
    sanitizedArgs: sanitizeArgs(argv),
    spanId: generateSpanId(),
    traceId: currentTraceId ?? generateTraceId(),
  };
}

/**
 * Record the end of a command execution.
 * Creates and sends a span with command metadata.
 *
 * @param ctx The context returned by recordCommandStart
 * @param success Whether the command completed successfully
 */
export function recordCommandEnd(ctx: CommandContext, success: boolean): void {
  // TODO: Replace with actual isTelemetryEnabled() check
  // if (!isTelemetryEnabled() || !isWorkerInitialized()) {
  if (!isTelemetryEnabled() || !isWorkerInitialized()) {
    return;
  }

  const endTime = performance.now();
  const durationMs = endTime - ctx.startTime;

  // Calculate start and end times in nanoseconds
  const startTimeNano = (() => {
    const startMs = performance.timeOrigin + ctx.startTime;
    const seconds = Math.floor(startMs / 1000);
    const nanoseconds = Math.round((startMs % 1000) * 1e6);
    return hrTimeToNano([seconds, nanoseconds]);
  })();

  const endTimeNano = (() => {
    const endMs = performance.timeOrigin + endTime;
    const seconds = Math.floor(endMs / 1000);
    const nanoseconds = Math.round((endMs % 1000) * 1e6);
    return hrTimeToNano([seconds, nanoseconds]);
  })();

  const span: SerializedSpan = {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    name: `nx.command.${ctx.command}`,
    startTimeUnixNano: startTimeNano,
    endTimeUnixNano: endTimeNano,
    status: {
      code: success ? 1 : 2, // 1 = OK, 2 = ERROR in OTEL spec
      message: success ? undefined : 'Command failed',
    },
    attributes: toAttributes({
      'nx.command': ctx.command,
      'nx.command.duration_ms': durationMs,
      'nx.command.success': success,
      'nx.version': getNxVersion(),
      'node.version': process.version,
      'os.platform': process.platform,
      'os.arch': process.arch,
    }),
    resourceAttributes: toAttributes({
      'service.name': 'nx-cli',
      'telemetry.sdk.name': 'nx-telemetry',
    }),
    events: [],
  };

  sendSpans([span]);
}

/**
 * Record a task execution event.
 * Project names are anonymized and custom targets are sanitized.
 */
export function recordTaskExecution(task: {
  project: string;
  target: string;
  durationMs: number;
  status: 'success' | 'failure' | 'skipped';
  cacheStatus: 'local-hit' | 'remote-hit' | 'miss' | 'disabled';
}): void {
  if (!isTelemetryEnabled() || !isWorkerInitialized()) {
    return;
  }

  const now = nowNano();

  // Calculate start time based on duration
  const endMs = performance.timeOrigin + performance.now();
  const startMs = endMs - task.durationMs;
  const startTimeNano = (() => {
    const seconds = Math.floor(startMs / 1000);
    const nanoseconds = Math.round((startMs % 1000) * 1e6);
    return hrTimeToNano([seconds, nanoseconds]);
  })();

  // Sanitize project name and target
  const sanitizedProject = anonymizeProjectName(task.project);
  const sanitizedTarget = sanitizeTarget(task.target);

  const span: SerializedSpan = {
    traceId: currentTraceId ?? generateTraceId(),
    spanId: generateSpanId(),
    name: `nx.task.${sanitizedTarget}`,
    startTimeUnixNano: startTimeNano,
    endTimeUnixNano: now,
    status: {
      code: task.status === 'success' ? 1 : 2,
      message: task.status === 'failure' ? 'Task failed' : undefined,
    },
    attributes: toAttributes({
      'nx.task.project': sanitizedProject,
      'nx.task.target': sanitizedTarget,
      'nx.task.duration_ms': task.durationMs,
      'nx.task.status': task.status,
      'nx.task.cache_status': task.cacheStatus,
    }),
    resourceAttributes: toAttributes({
      'service.name': 'nx-cli',
    }),
    events: [],
  };

  sendSpans([span]);
}

/**
 * Record an error event.
 * Error messages and stack traces are sanitized to remove sensitive information.
 */
export function recordError(
  error: Error,
  phase: string,
  command: string
): void {
  if (!isTelemetryEnabled() || !isWorkerInitialized()) {
    return;
  }

  const now = nowNano();

  // Sanitize error message and stack trace
  const sanitizedMessage = error.message
    ? sanitizeErrorMessage(error.message)
    : undefined;
  const sanitizedStack = error.stack
    ? sanitizeStackTrace(error.stack)
    : undefined;

  const span: SerializedSpan = {
    traceId: currentTraceId ?? generateTraceId(),
    spanId: generateSpanId(),
    name: 'nx.error',
    startTimeUnixNano: now,
    endTimeUnixNano: now,
    status: {
      code: 2, // ERROR
      message: error.name || 'Error',
    },
    attributes: toAttributes({
      'nx.error.type': error.name || 'Error',
      'nx.error.phase': phase,
      'nx.error.command': command,
      ...(sanitizedMessage && { 'nx.error.message': sanitizedMessage }),
      ...(sanitizedStack && { 'nx.error.stack': sanitizedStack }),
    }),
    resourceAttributes: toAttributes({
      'service.name': 'nx-cli',
    }),
    events: [],
  };

  sendSpans([span]);
}

/**
 * Flush any pending telemetry data.
 * Should be called before process exit.
 */
export async function flushTelemetry(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  await flush();
}

/**
 * Shutdown telemetry and clean up resources.
 * Should be called when the process is exiting.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  await shutdown();
  isInitialized = false;
  currentTraceId = null;
}

/**
 * Get the current Nx version.
 */
function getNxVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../../../package.json').version;
  } catch {
    return 'unknown';
  }
}
