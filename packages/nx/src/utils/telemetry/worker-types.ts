/**
 * Attribute value type for NX Cloud trace format.
 * Only one of the value fields should be set.
 */
export interface AttributeValue {
  stringValue?: string;
  intValue?: string;
  doubleValue?: string;
  boolValue?: boolean;
}

/**
 * Key-value attribute pair for spans and events.
 */
export interface SerializedAttribute {
  key: string;
  value: AttributeValue;
}

/**
 * Serialized span event for NX Cloud ingestion.
 */
export interface SerializedSpanEvent {
  timeUnixNano: string;
  name: string;
  attributes: SerializedAttribute[];
}

/**
 * Serialized span format for export to NX Cloud.
 * Matches the format expected by the /nx-cloud/ingest-fix-ci-traces endpoint.
 */
export interface SerializedSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string; // BigInt as string for precision
  endTimeUnixNano: string; // BigInt as string for precision
  status: {
    code: number;
    message?: string;
  };
  attributes: SerializedAttribute[];
  resourceAttributes: SerializedAttribute[];
  events: SerializedSpanEvent[];
}

/**
 * Payload sent to NX Cloud for trace ingestion.
 */
export interface TraceExportPayload {
  aiFixId: string;
  spans: SerializedSpan[];
}

/**
 * Configuration message sent to worker on initialization.
 */
export interface WorkerConfigMessage {
  type: 'config';
  endpoint: string;
  accessToken: string;
  aiFixId: string;
}

/**
 * Export message containing spans to send.
 */
export interface WorkerExportMessage {
  type: 'export';
  spans: SerializedSpan[];
}

/**
 * Flush message to trigger immediate export of buffered spans.
 */
export interface WorkerFlushMessage {
  type: 'flush';
}

/**
 * Shutdown message for graceful worker termination.
 */
export interface WorkerShutdownMessage {
  type: 'shutdown';
}

/**
 * Messages from main thread to worker.
 */
export type WorkerMessage =
  | WorkerConfigMessage
  | WorkerExportMessage
  | WorkerFlushMessage
  | WorkerShutdownMessage;

/**
 * Ready response after worker initialization.
 */
export interface WorkerReadyResponse {
  type: 'ready';
}

/**
 * Flushed response after buffer export completes.
 */
export interface WorkerFlushedResponse {
  type: 'flushed';
}

/**
 * Shutdown complete response before worker terminates.
 */
export interface WorkerShutdownCompleteResponse {
  type: 'shutdown-complete';
}

/**
 * Error response for non-fatal errors.
 */
export interface WorkerErrorResponse {
  type: 'error';
  message: string;
}

/**
 * Messages from worker to main thread.
 */
export type WorkerResponse =
  | WorkerReadyResponse
  | WorkerFlushedResponse
  | WorkerShutdownCompleteResponse
  | WorkerErrorResponse;
