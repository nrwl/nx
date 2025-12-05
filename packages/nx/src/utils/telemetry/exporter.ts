import { Worker } from 'worker_threads';
import { join } from 'path';
import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import type {
  SerializedSpan,
  SerializedAttribute,
  WorkerMessage,
  WorkerResponse,
} from './worker-types';

const DEFAULT_NX_CLOUD_API = 'https://snapshot.nx.app';
const FLUSH_TIMEOUT_MS = 5000;
const SHUTDOWN_TIMEOUT_MS = 10000;

let worker: Worker | null = null;
let isConfigured = false;
let currentAiFixId: string | null = null;

/**
 * Generate a timestamp-based aiFixId.
 * Format: nx-telemetry-{ISO-timestamp-with-dashes}
 * Example: nx-telemetry-2025-12-05T10-30-45-123Z
 */
function generateAiFixId(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\./g, '-');
  return `nx-telemetry-${timestamp}`;
}

/**
 * Get the worker script path.
 * Handles both development (.ts) and production (.js) scenarios.
 */
function getWorkerPath(): string {
  // In production, the worker will be compiled to .js
  // __dirname will point to the compiled output directory
  return join(__dirname, 'worker.js');
}

/**
 * Send a message to the worker.
 */
function postMessage(message: WorkerMessage): void {
  if (worker) {
    worker.postMessage(message);
  }
}

/**
 * Wait for a specific response type from the worker with timeout.
 */
function waitForResponse(
  responseType: WorkerResponse['type'],
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve) => {
    if (!worker) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      // Don't reject on timeout - telemetry should not block
      resolve();
    }, timeoutMs);

    const handleMessage = (response: WorkerResponse) => {
      if (response.type === responseType) {
        cleanup();
        resolve();
      } else if (response.type === 'error') {
        // Log error but don't reject - telemetry should not block
        console.warn(`[nx telemetry] Worker error: ${response.message}`);
      }
    };

    const handleError = (error: Error) => {
      cleanup();
      // Log error but don't reject - telemetry should not block
      console.warn(`[nx telemetry] Worker error: ${error.message}`);
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timeout);
      worker?.off('message', handleMessage);
      worker?.off('error', handleError);
    };

    worker.on('message', handleMessage);
    worker.on('error', handleError);
  });
}

/**
 * Initialize the telemetry worker.
 *
 * @param config Optional configuration. If not provided, uses environment variables.
 * @param config.endpoint NX Cloud API URL (default: NX_CLOUD_API env or https://cloud.nx.app)
 * @param config.accessToken Access token (default: NX_CLOUD_ACCESS_TOKEN env)
 * @param config.aiFixId Custom aiFixId (default: auto-generated timestamp-based ID)
 */
export async function initWorker(config?: {
  endpoint?: string;
  accessToken?: string;
  aiFixId?: string;
}): Promise<void> {
  if (worker) {
    // Already initialized
    return;
  }

  const accessToken =
    config?.accessToken ?? process.env.NX_CLOUD_ACCESS_TOKEN ?? '';
  const endpoint =
    config?.endpoint ?? process.env.NX_CLOUD_API ?? DEFAULT_NX_CLOUD_API;

  if (!accessToken) {
    // No access token - telemetry will be disabled
    // Don't start worker to save resources
    return;
  }

  currentAiFixId = config?.aiFixId ?? generateAiFixId();

  try {
    worker = new Worker(getWorkerPath());

    // Handle worker errors gracefully
    worker.on('error', (error) => {
      console.warn(`[nx telemetry] Worker error: ${error.message}`);
      worker = null;
      isConfigured = false;
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.warn(`[nx telemetry] Worker exited with code ${code}`);
      }
      worker = null;
      isConfigured = false;
    });

    // Send configuration to worker
    postMessage({
      type: 'config',
      endpoint,
      accessToken,
      aiFixId: currentAiFixId,
    });

    // Wait for ready response
    await waitForResponse('ready', FLUSH_TIMEOUT_MS);
    isConfigured = true;
  } catch (error) {
    // Failed to start worker - telemetry will be disabled
    console.warn(
      `[nx telemetry] Failed to initialize worker: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    worker = null;
  }
}

/**
 * Check if the telemetry worker is initialized and configured.
 */
export function isWorkerInitialized(): boolean {
  return worker !== null && isConfigured;
}

/**
 * Get the current aiFixId being used for telemetry.
 * Returns null if worker is not initialized.
 */
export function getAiFixId(): string | null {
  return currentAiFixId;
}

/**
 * Send spans to the worker for export.
 * No-op if worker is not initialized.
 */
export function sendSpans(spans: SerializedSpan[]): void {
  if (!worker || !isConfigured) {
    return;
  }

  postMessage({
    type: 'export',
    spans,
  });
}

/**
 * Flush any buffered spans in the worker.
 * Returns immediately if worker is not initialized.
 */
export async function flush(): Promise<void> {
  if (!worker || !isConfigured) {
    return;
  }

  postMessage({ type: 'flush' });
  await waitForResponse('flushed', FLUSH_TIMEOUT_MS);
}

/**
 * Shutdown the telemetry worker gracefully.
 * Flushes any remaining spans before terminating.
 */
export async function shutdownWorker(): Promise<void> {
  if (!worker) {
    return;
  }

  postMessage({ type: 'shutdown' });
  await waitForResponse('shutdown-complete', SHUTDOWN_TIMEOUT_MS);

  // Terminate the worker
  await worker.terminate();
  worker = null;
  isConfigured = false;
  currentAiFixId = null;
}

/**
 * Custom SpanExporter that sends traces to Nx Cloud via a worker thread.
 * Implements the OpenTelemetry SpanExporter interface.
 */
export class NxCloudSpanExporter implements SpanExporter {
  private pendingExports: Set<Promise<void>> = new Set();

  /**
   * Export spans by serializing them and sending to the worker thread.
   */
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    if (!isWorkerInitialized()) {
      // Worker not initialized, but don't fail - just succeed silently
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    const serializedSpans = spans.map((span) => this.serializeSpan(span));

    // Send to worker (fire and forget from exporter's perspective)
    sendSpans(serializedSpans);

    // Always report success - worker handles failures internally
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  /**
   * Force flush any pending exports.
   */
  async forceFlush(): Promise<void> {
    await flush();
  }

  /**
   * Shutdown the exporter and worker.
   */
  async shutdown(): Promise<void> {
    await shutdownWorker();
  }

  /**
   * Serialize an OpenTelemetry ReadableSpan to the format expected by Nx Cloud.
   */
  private serializeSpan(span: ReadableSpan): SerializedSpan {
    const spanContext = span.spanContext();

    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      startTimeUnixNano: this.hrTimeToNano(span.startTime),
      endTimeUnixNano: this.hrTimeToNano(span.endTime),
      status: {
        code: span.status.code,
        message: span.status.message,
      },
      attributes: this.serializeAttributes(span.attributes),
      resourceAttributes: this.serializeAttributes(span.resource.attributes),
      events: span.events.map((event) => ({
        timeUnixNano: this.hrTimeToNano(event.time),
        name: event.name,
        attributes: this.serializeAttributes(event.attributes ?? {}),
      })),
    };
  }

  /**
   * Convert hrTime [seconds, nanoseconds] to nanoseconds string.
   */
  private hrTimeToNano(hrTime: [number, number]): string {
    const nanos = BigInt(hrTime[0]) * BigInt(1e9) + BigInt(hrTime[1]);
    return nanos.toString();
  }

  /**
   * Convert attributes object to serialized format.
   */
  private serializeAttributes(
    attributes: Record<string, unknown>
  ): SerializedAttribute[] {
    return Object.entries(attributes).map(([key, value]) => {
      if (typeof value === 'string') {
        return { key, value: { stringValue: value } };
      } else if (typeof value === 'number') {
        // Use intValue for integers, doubleValue for floats
        if (Number.isInteger(value)) {
          return { key, value: { intValue: String(value) } };
        } else {
          return { key, value: { doubleValue: String(value) } };
        }
      } else if (typeof value === 'boolean') {
        return { key, value: { boolValue: value } };
      } else if (Array.isArray(value)) {
        // Serialize arrays as JSON strings
        return { key, value: { stringValue: JSON.stringify(value) } };
      } else {
        return { key, value: { stringValue: String(value) } };
      }
    });
  }
}

/**
 * No-op exporter for when tracing is disabled.
 */
export class NoOpSpanExporter implements SpanExporter {
  export(
    _spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  async forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  async shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
