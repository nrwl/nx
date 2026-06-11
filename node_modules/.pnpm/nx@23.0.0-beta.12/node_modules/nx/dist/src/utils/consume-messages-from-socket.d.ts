export declare const MESSAGE_END_SEQ: string;
export declare function consumeMessagesFromSocket(callback: (message: string) => void): (data: any) => void;
export declare function isJsonMessage(message: string): boolean;
/**
 * Parse a message that was produced by `serialize()` in
 * `daemon/socket-utils.ts`. Auto-detects JSON vs. v8-serialized payloads using
 * `isJsonMessage()` and decodes the binary path via `v8.deserialize`.
 */
export declare function parseMessage<T = unknown>(message: string): T;
