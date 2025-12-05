import { parentPort } from 'worker_threads';
import type {
  SerializedSpan,
  TraceExportPayload,
  WorkerMessage,
  WorkerResponse,
} from './worker-types';

// Configuration (set via 'config' message)
let endpoint: string | null = null;
let accessToken: string | null = null;
let aiFixId: string | null = null;

// Buffering
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 5000;
let spanBuffer: SerializedSpan[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingExports: Promise<void>[] = [];

/**
 * Send response to main thread.
 */
function respond(response: WorkerResponse): void {
  parentPort?.postMessage(response);
}

/**
 * Export spans to NX Cloud endpoint.
 * Silent failures - logs warnings but doesn't throw.
 */
async function exportSpans(spans: SerializedSpan[]): Promise<void> {
  if (!endpoint || !accessToken || !aiFixId) {
    // Not configured yet, silently skip
    return;
  }

  if (spans.length === 0) {
    return;
  }

  const payload: TraceExportPayload = {
    aiFixId,
    spans,
  };

  const url = `${endpoint}/nx-cloud/ingest-fix-ci-traces`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Log but don't throw - telemetry should not break main flow
      console.warn(
        `[nx telemetry] Failed to export traces: HTTP ${response.status}`
      );
    }
  } catch (error) {
    // Log but don't throw - telemetry should not break main flow
    console.warn(
      `[nx telemetry] Failed to export traces: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Flush the current buffer immediately.
 */
async function flushBuffer(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (spanBuffer.length === 0) {
    return;
  }

  const spansToExport = spanBuffer;
  spanBuffer = [];

  const exportPromise = exportSpans(spansToExport);
  pendingExports.push(exportPromise);

  try {
    await exportPromise;
  } finally {
    pendingExports = pendingExports.filter((p) => p !== exportPromise);
  }
}

/**
 * Schedule a flush after the interval if not already scheduled.
 */
function scheduleFlush(): void {
  if (flushTimer === null && spanBuffer.length > 0) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushBuffer().catch(() => {
        // Silently ignore flush errors
      });
    }, FLUSH_INTERVAL_MS);
  }
}

/**
 * Add spans to buffer and flush if batch size reached.
 */
function bufferSpans(spans: SerializedSpan[]): void {
  spanBuffer.push(...spans);

  if (spanBuffer.length >= BATCH_SIZE) {
    flushBuffer().catch(() => {
      // Silently ignore flush errors
    });
  } else {
    scheduleFlush();
  }
}

/**
 * Handle incoming messages from main thread.
 */
function handleMessage(message: WorkerMessage): void {
  switch (message.type) {
    case 'config':
      endpoint = message.endpoint;
      accessToken = message.accessToken;
      aiFixId = message.aiFixId;
      respond({ type: 'ready' });
      break;

    case 'export':
      bufferSpans(message.spans);
      break;

    case 'flush':
      flushBuffer()
        .then(() => {
          // Wait for any pending exports to complete
          return Promise.all(pendingExports);
        })
        .then(() => {
          respond({ type: 'flushed' });
        })
        .catch((error) => {
          respond({
            type: 'error',
            message:
              error instanceof Error ? error.message : 'Unknown flush error',
          });
          // Still respond with flushed to unblock main thread
          respond({ type: 'flushed' });
        });
      break;

    case 'shutdown':
      flushBuffer()
        .then(() => {
          return Promise.all(pendingExports);
        })
        .then(() => {
          respond({ type: 'shutdown-complete' });
        })
        .catch(() => {
          // Still respond to unblock main thread
          respond({ type: 'shutdown-complete' });
        });
      break;
  }
}

// Set up message handler
if (parentPort) {
  parentPort.on('message', handleMessage);
}
