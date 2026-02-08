/**
 * Generic message type system for socket-based IPC.
 *
 * Provides type-safe message definitions with automatic result type derivation.
 * Used by the plugin worker messaging layer but generic enough for any
 * request/response protocol over sockets.
 */

export interface BaseMessage {
  tx: string;
}

export type MaybePromise<T> = T | Promise<T>;

/**
 * Constraint for message definitions.
 * - payload: required, the message payload
 * - result: optional, if present this message expects a response
 */
export type MessageDef = {
  payload: unknown;
  result?: unknown;
};

export type MessageDefs = Record<string, MessageDef>;

/**
 * DefineMessages<T> - purely a type-level construct for defining
 * a set of related messages with their payloads and optional results.
 */
export type DefineMessages<TDefs extends MessageDefs> = TDefs;

// =============================================================================
// TYPE EXTRACTION HELPERS
// =============================================================================

/** Get keys that have results defined */
export type WithResult<TDefs extends MessageDefs> = {
  [K in keyof TDefs]: TDefs[K] extends { result: unknown } ? K : never;
}[keyof TDefs];

/** Extract the full message type for a given key */
export type MessageOf<
  TDefs extends MessageDefs,
  K extends keyof TDefs,
> = BaseMessage & {
  type: K;
  payload: TDefs[K]['payload'];
};

/** Extract the full result type for a given key */
export type ResultOf<
  TDefs extends MessageDefs,
  K extends WithResult<TDefs>,
> = BaseMessage & {
  type: `${K & string}Result`;
  payload: TDefs[K]['result'];
};

/** Union of all message types */
export type AllMessages<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: MessageOf<TDefs, K>;
}[keyof TDefs & string];

/** Union of all result types */
export type AllResults<TDefs extends MessageDefs> = {
  [K in WithResult<TDefs> & string]: ResultOf<TDefs, K>;
}[WithResult<TDefs> & string];

/**
 * Handler map type - handlers return just the result payload directly.
 * The infrastructure wraps the return value in { type: '${key}Result', payload, tx }.
 */
export type Handlers<TDefs extends MessageDefs> = {
  [K in keyof TDefs & string]: (
    payload: TDefs[K]['payload']
  ) => TDefs[K] extends { result: unknown }
    ? MaybePromise<TDefs[K]['result'] | void>
    : MaybePromise<void>;
};
