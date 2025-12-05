/**
 * Telemetry module for Nx anonymous usage data collection.
 *
 * This module provides:
 * - OpenTelemetry-based tracing with AsyncHooksContextManager for context propagation
 * - Settings resolution from multiple sources (env, repo, user)
 * - User preferences storage in ~/.nxrc
 * - Opt-in prompt for interactive sessions
 */

import {
  trace,
  SpanStatusCode,
  type Tracer,
  type Span,
} from '@opentelemetry/api';
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';

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

import {
  sanitizeArgs,
  sanitizeTarget,
  anonymizeProjectName,
  sanitizeErrorMessage,
  sanitizeStackTrace,
} from './sanitize';
import {
  initWorker,
  isWorkerInitialized,
  getAiFixId,
  NxCloudSpanExporter,
  NoOpSpanExporter,
} from './exporter';

// Re-export types that consumers might need
export type { SerializedSpan, SerializedAttribute } from './worker-types';

// Re-export OpenTelemetry types
export { SpanStatusCode };
export type { Span, Tracer };

let provider: BasicTracerProvider | null = null;
let tracerInstance: Tracer | null = null;
let isInitialized = false;

/**
 * Check if telemetry is enabled.
 * TODO: This will be replaced with actual settings resolution from Phase 1/2.
 */
function isTelemetryEnabledInternal(): boolean {
  // Placeholder - will be replaced with actual implementation
  // For now, check if NX_CLOUD_ACCESS_TOKEN is set
  return true; // !!process.env.NX_CLOUD_ACCESS_TOKEN;
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

/**
 * Initialize telemetry for the current Nx session.
 * Sets up OpenTelemetry with AsyncHooksContextManager for proper
 * context propagation across async boundaries.
 *
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

  if (!isTelemetryEnabledInternal()) {
    return;
  }

  // 1. Create Resource with service metadata
  const resource = new Resource({
    'service.name': 'nx-cli',
    'telemetry.sdk.name': 'nx-telemetry',
    'nx.version': getNxVersion(),
    'node.version': process.version,
    'os.platform': process.platform,
    'os.arch': process.arch,
  });

  // 2. Create provider
  provider = new BasicTracerProvider({ resource });

  // 3. Initialize worker and create exporter
  await initWorker();

  // Use NxCloudSpanExporter if worker is initialized, otherwise NoOpSpanExporter
  const exporter = isWorkerInitialized()
    ? new NxCloudSpanExporter()
    : new NoOpSpanExporter();

  // 4. Add span processor
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

  // 5. Create and enable AsyncHooksContextManager for proper context propagation
  const contextManager = new AsyncHooksContextManager();
  contextManager.enable();

  // 6. Register the provider globally with the async context manager
  provider.register({
    contextManager,
  });

  // 7. Get tracer instance
  tracerInstance = trace.getTracer('nx-cli');
  isInitialized = true;
}

/**
 * Get the initialized tracer.
 * Returns null if telemetry is not initialized.
 */
export function getTracer(): Tracer | null {
  return tracerInstance;
}

/**
 * Record the start of a command execution.
 * Returns a Span that should be ended when the command completes.
 *
 * @param command The command name (e.g., 'build', 'test', 'run')
 * @param argv The command arguments (will be sanitized)
 */
export function recordCommandStart(
  command: string,
  argv: string[]
): Span | null {
  const tracer = getTracer();
  if (!tracer) {
    return null;
  }

  const span = tracer.startSpan(`nx.command.${command}`, {
    attributes: {
      'nx.command': command,
      'nx.command.args': JSON.stringify(sanitizeArgs(argv)),
    },
  });

  return span;
}

/**
 * Record the end of a command execution.
 *
 * @param span The span returned by recordCommandStart
 * @param success Whether the command completed successfully
 */
export function recordCommandEnd(span: Span | null, success: boolean): void {
  if (!span) {
    return;
  }

  span.setStatus({
    code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR,
    message: success ? undefined : 'Command failed',
  });
  span.end();
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
  const tracer = getTracer();
  if (!tracer) {
    return;
  }

  // Sanitize project name and target
  const sanitizedProject = anonymizeProjectName(task.project);
  const sanitizedTargetName = sanitizeTarget(task.target);

  const span = tracer.startSpan(`nx.task.${sanitizedTargetName}`, {
    attributes: {
      'nx.task.project': sanitizedProject,
      'nx.task.target': sanitizedTargetName,
      'nx.task.duration_ms': task.durationMs,
      'nx.task.status': task.status,
      'nx.task.cache_status': task.cacheStatus,
    },
  });

  span.setStatus({
    code: task.status === 'success' ? SpanStatusCode.OK : SpanStatusCode.ERROR,
    message: task.status === 'failure' ? 'Task failed' : undefined,
  });

  span.end();
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
  const tracer = getTracer();
  if (!tracer) {
    return;
  }

  // Sanitize error message and stack trace
  const sanitizedMessage = error.message
    ? sanitizeErrorMessage(error.message)
    : undefined;
  const sanitizedStack = error.stack
    ? sanitizeStackTrace(error.stack)
    : undefined;

  const span = tracer.startSpan('nx.error', {
    attributes: {
      'nx.error.type': error.name || 'Error',
      'nx.error.phase': phase,
      'nx.error.command': command,
      ...(sanitizedMessage && { 'nx.error.message': sanitizedMessage }),
      ...(sanitizedStack && { 'nx.error.stack': sanitizedStack }),
    },
  });

  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.name || 'Error',
  });

  span.end();
}

/**
 * Flush any pending telemetry data.
 * Should be called before process exit.
 */
export async function flushTelemetry(): Promise<void> {
  if (!isInitialized || !provider) {
    return;
  }

  await provider.forceFlush();
}

/**
 * Shutdown telemetry and clean up resources.
 * Should be called when the process is exiting.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!isInitialized || !provider) {
    return;
  }

  await provider.shutdown();
  provider = null;
  tracerInstance = null;
  isInitialized = false;
}

/**
 * Get the current aiFixId being used for telemetry.
 * Returns null if telemetry is not initialized.
 */
export { getAiFixId };
