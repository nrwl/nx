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
  context,
  SpanStatusCode,
  type Context,
  type Tracer,
  type Span,
  type AttributeValue,
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
import { isTelemetryEnabled as checkTelemetryEnabled } from './resolve-settings';
import { readNxJson, type NxJsonConfiguration } from '../../config/nx-json';

// Re-export types that consumers might need
export type { SerializedSpan, SerializedAttribute } from './worker-types';

// Re-export OpenTelemetry types
export { SpanStatusCode, context as otelContext };
export type { Span, Tracer, Context };

let provider: BasicTracerProvider | null = null;
let tracerInstance: Tracer | null = null;
let isInitialized = false;
let cachedNxJson: NxJsonConfiguration | null = null;

/**
 * Check if telemetry is enabled based on resolved settings.
 * Uses the settings resolution from resolve-settings.ts which checks:
 * 1. NX_TELEMETRY environment variable
 * 2. nx.json telemetry section
 * 3. ~/.nxrc user settings (non-CI only)
 * 4. Defaults based on environment (CI=enabled, interactive=prompt needed, non-interactive=disabled)
 */
function isTelemetryEnabledInternal(): boolean {
  return checkTelemetryEnabled(cachedNxJson);
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
 * Load nx.json from the workspace root.
 * Returns null if the file doesn't exist or can't be parsed.
 */
function loadNxJson(workspaceRoot: string | null): NxJsonConfiguration | null {
  if (!workspaceRoot) {
    return null;
  }

  try {
    return readNxJson(workspaceRoot);
  } catch {
    return null;
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

  // Load nx.json for settings resolution
  cachedNxJson = loadNxJson(workspaceRoot);

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
 * Returns a Span and the Context with that span active.
 * The context should be used with `context.with()` to ensure child spans
 * are properly connected to the command span.
 *
 * @param command The command name (e.g., 'build', 'test', 'run')
 * @param argv The command arguments (will be sanitized)
 */
export function recordCommandStart(
  command: string,
  argv: string[]
): { span: Span; ctx: Context } | null {
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

  // Create context with this span as active so child spans are connected
  const ctx = trace.setSpan(context.active(), span);

  return { span, ctx };
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
 * Execute an async function within a telemetry span.
 * Automatically handles:
 * - Span creation with initial attributes
 * - Context propagation for child spans
 * - Success/error status based on execution result
 * - Span cleanup on completion
 *
 * @param name The span name (e.g., 'nx.project_graph.create')
 * @param attributes Initial span attributes
 * @param fn The async function to execute. Receives a callback to add attributes after execution.
 * @returns The result of the async function
 *
 * @example
 * const result = await withSpan(
 *   'nx.project_graph.create',
 *   { 'nx.project_graph.daemon_enabled': true },
 *   async (addAttributes) => {
 *     const graph = await buildGraph();
 *     addAttributes({ 'nx.project_graph.project_count': Object.keys(graph.nodes).length });
 *     return graph;
 *   }
 * );
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, AttributeValue>,
  fn: (
    addAttributes: (attrs: Record<string, AttributeValue>) => void
  ) => Promise<T>
): Promise<T> {
  const tracer = getTracer();
  if (!tracer) {
    // If telemetry not enabled, just run the function
    return fn(() => {});
  }

  const span = tracer.startSpan(name, { attributes });
  const ctx = trace.setSpan(context.active(), span);

  try {
    const result = await context.with(ctx, () =>
      fn((attrs) => {
        for (const [key, value] of Object.entries(attrs)) {
          span.setAttribute(key, value);
        }
      })
    );
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (e) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  } finally {
    span.end();
  }
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
