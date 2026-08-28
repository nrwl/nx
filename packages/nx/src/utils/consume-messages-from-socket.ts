import type { Socket } from 'net';
import { deserialize } from 'v8';

export const MESSAGE_HEADER_PREFIX = 'NX_MSG_';
const MESSAGE_HEADER_TERMINATOR = ':'.charCodeAt(0);
const MESSAGE_HEADER_PREFIX_BYTES = Buffer.from(MESSAGE_HEADER_PREFIX, 'ascii');
// `Number.MAX_SAFE_INTEGER` is 16 digits, so a longer run of digits than that
// is a desynchronized stream rather than a very large message.
const MAX_HEADER_LENGTH = MESSAGE_HEADER_PREFIX.length + 16 + 1;

/**
 * How long a partially received message may sit with no further bytes before
 * the stream is treated as broken. A peer that dies mid-write normally closes
 * the socket; this only covers the case where it stops writing but holds the
 * connection open.
 */
export const INCOMPLETE_MESSAGE_TIMEOUT_MS = 60_000;

const ZERO = '0'.charCodeAt(0);
const NINE = '9'.charCodeAt(0);

export function frameHeader(payloadLength: number): Buffer {
  return Buffer.from(`${MESSAGE_HEADER_PREFIX}${payloadLength}:`, 'ascii');
}

/**
 * Writes a length-prefixed message. The header and payload are written
 * separately so a large payload is never copied to prepend its header.
 */
export function writeMessage(
  socket: Socket,
  payload: Buffer,
  callback?: (err?: Error) => void
): void {
  socket.write(frameHeader(payload.length));
  socket.write(payload, callback);
}

export class MessageFramingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessageFramingError';
    Object.setPrototypeOf(this, MessageFramingError.prototype);
  }
}

export function consumeMessagesFromSocket(
  callback: (message: Buffer) => void,
  onError: (error: MessageFramingError) => void = (error) => {
    console.error(error.message);
  }
) {
  let chunks: Buffer[] = [];
  let buffered = 0;
  let expectedPayloadLength: number | null = null;
  let idleTimer: NodeJS.Timeout | undefined;
  let broken = false;

  const disarmIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  };

  const armIdleTimer = () => {
    disarmIdleTimer();
    if (buffered === 0) {
      return;
    }
    idleTimer = setTimeout(() => {
      fail(
        `Timed out after ${INCOMPLETE_MESSAGE_TIMEOUT_MS}ms waiting for the rest of a message. ` +
          `Expected ${expectedPayloadLength ?? 'a header'} bytes, received ${buffered}.`
      );
    }, INCOMPLETE_MESSAGE_TIMEOUT_MS);
    idleTimer.unref?.();
  };

  const fail = (message: string) => {
    broken = true;
    chunks = [];
    buffered = 0;
    expectedPayloadLength = null;
    disarmIdleTimer();
    onError(new MessageFramingError(message));
  };

  // Copies at most `length` leading bytes without collapsing the chunk list.
  const peek = (length: number): Buffer => {
    const size = Math.min(length, buffered);
    if (chunks.length === 1) {
      return chunks[0].subarray(0, size);
    }
    const out = Buffer.allocUnsafe(size);
    let offset = 0;
    for (const chunk of chunks) {
      if (offset >= size) break;
      offset += chunk.copy(
        out,
        offset,
        0,
        Math.min(chunk.length, size - offset)
      );
    }
    return out;
  };

  const take = (length: number): Buffer => {
    if (length === 0) {
      return Buffer.alloc(0);
    }
    if (chunks[0].length === length) {
      buffered -= length;
      return chunks.shift();
    }
    const out = Buffer.allocUnsafe(length);
    let offset = 0;
    while (offset < length) {
      const chunk = chunks[0];
      const needed = length - offset;
      if (chunk.length <= needed) {
        chunk.copy(out, offset);
        offset += chunk.length;
        chunks.shift();
      } else {
        chunk.copy(out, offset, 0, needed);
        chunks[0] = chunk.subarray(needed);
        offset = length;
      }
    }
    buffered -= length;
    return out;
  };

  const discard = (length: number) => {
    let remaining = length;
    while (remaining > 0) {
      const chunk = chunks[0];
      if (chunk.length <= remaining) {
        remaining -= chunk.length;
        chunks.shift();
      } else {
        chunks[0] = chunk.subarray(remaining);
        remaining = 0;
      }
    }
    buffered -= length;
  };

  // Returns the payload length, or null when the header is still incomplete.
  const readHeader = (): number | null => {
    const head = peek(MAX_HEADER_LENGTH);

    for (let i = 0; i < MESSAGE_HEADER_PREFIX_BYTES.length; i++) {
      if (i >= head.length) return null;
      if (head[i] !== MESSAGE_HEADER_PREFIX_BYTES[i]) {
        fail(
          `Expected a message to begin with '${MESSAGE_HEADER_PREFIX}' but received ` +
            `${JSON.stringify(head.toString('utf8', 0, 32))}. The stream is out of sync.`
        );
        return null;
      }
    }

    let digits = 0;
    let value = 0;
    for (let i = MESSAGE_HEADER_PREFIX_BYTES.length; i < head.length; i++) {
      const byte = head[i];
      if (byte === MESSAGE_HEADER_TERMINATOR) {
        if (digits === 0) {
          fail(`Message header carried no length.`);
          return null;
        }
        discard(i + 1);
        return value;
      }
      if (byte < ZERO || byte > NINE) {
        fail(
          `Message header contained a non-digit length. The stream is out of sync.`
        );
        return null;
      }
      value = value * 10 + (byte - ZERO);
      digits++;
    }

    if (head.length >= MAX_HEADER_LENGTH) {
      fail(`Message header exceeded ${MAX_HEADER_LENGTH} bytes without a ':'.`);
    }
    return null;
  };

  return (data: Buffer) => {
    if (broken) {
      return;
    }
    chunks.push(data);
    buffered += data.length;

    while (!broken) {
      if (expectedPayloadLength === null) {
        const length = readHeader();
        if (length === null) break;
        expectedPayloadLength = length;
      }
      if (buffered < expectedPayloadLength) break;
      const payload = take(expectedPayloadLength);
      expectedPayloadLength = null;
      callback(payload);
    }

    if (!broken) {
      armIdleTimer();
    }
  };
}

/**
 * v8-serialized payloads always begin with the 0xFF version header, which no
 * JSON document can start with.
 */
export function isJsonMessage(message: Buffer): boolean {
  return message.length === 0 || message[0] !== 0xff;
}

/**
 * Parse a message produced by `serialize()` in `daemon/socket-utils.ts`.
 */
export function parseMessage<T = unknown>(message: Buffer): T {
  return isJsonMessage(message)
    ? JSON.parse(message.toString('utf8'))
    : deserialize(message);
}
