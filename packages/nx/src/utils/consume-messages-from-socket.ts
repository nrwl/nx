import type { Socket } from 'net';
import { deserialize } from 'v8';

export const MESSAGE_HEADER_PREFIX = 'NX_MSG_';
const MESSAGE_HEADER_TERMINATOR = ':'.charCodeAt(0);
const MESSAGE_HEADER_PREFIX_BYTES = Buffer.from(MESSAGE_HEADER_PREFIX, 'ascii');
// `Number.MAX_SAFE_INTEGER` is 16 digits, so a longer run of digits than that
// is a desynchronized stream rather than a very large message.
const MAX_HEADER_LENGTH = MESSAGE_HEADER_PREFIX.length + 16 + 1;

/**
 * Ceiling on a single message, in bytes. Payloads are buffered outside the V8
 * heap, so `--max-old-space-size` does not bound them and a peer that declares
 * a huge length would otherwise be allowed to stream until the machine gives
 * out. The default is four times the ~0.5GiB string ceiling that used to cap
 * every message, so it clears any payload that previously worked or was meant
 * to. Set `NX_MAX_MESSAGE_SIZE` to another byte count to change it, or to 0 to
 * remove the ceiling.
 */
export const DEFAULT_MAX_MESSAGE_SIZE = 2 * 1024 * 1024 * 1024;

export function getMaxMessageSize(): number {
  const configured = process.env.NX_MAX_MESSAGE_SIZE;
  if (configured === undefined || configured === '') {
    return DEFAULT_MAX_MESSAGE_SIZE;
  }
  const parsed = Number(configured);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.warn(
      `NX_MAX_MESSAGE_SIZE must be a non-negative number of bytes, but was "${configured}". Using the default of ${DEFAULT_MAX_MESSAGE_SIZE}.`
    );
    return DEFAULT_MAX_MESSAGE_SIZE;
  }
  return parsed;
}

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
  let broken = false;
  // Read once per socket so a test or a caller can change it between
  // connections without paying the lookup on every frame.
  const maxMessageSize = getMaxMessageSize();

  const fail = (message: string) => {
    broken = true;
    chunks = [];
    buffered = 0;
    expectedPayloadLength = null;
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
        if (maxMessageSize > 0 && value > maxMessageSize) {
          fail(
            `Message of ${value} bytes exceeds the ${maxMessageSize} byte limit. ` +
              `Set NX_MAX_MESSAGE_SIZE to raise it, or to 0 to remove it.`
          );
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
      if (expectedPayloadLength === 0) {
        fail('Message header declared a zero-length payload.');
        break;
      }
      if (buffered < expectedPayloadLength) break;
      const payload = take(expectedPayloadLength);
      expectedPayloadLength = null;
      callback(payload);
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
 * Widest slice of `window` that holds only whole utf8 characters. Cutting at an
 * arbitrary byte leaves a partial sequence, and a partial sequence decodes to
 * U+FFFD, which is the corruption `describeMessage` exists to avoid. A slice
 * taken from the end can also begin mid-character, so both edges are trimmed.
 */
function trimToCharBoundary(window: Buffer, from: 'start' | 'end'): Buffer {
  const isContinuation = (byte: number) => (byte & 0xc0) === 0x80;

  if (from === 'end') {
    let offset = 0;
    while (offset < window.length && isContinuation(window[offset])) {
      offset++;
    }
    return window.subarray(offset);
  }

  let lead = window.length - 1;
  while (lead >= 0 && isContinuation(window[lead])) {
    lead--;
  }
  if (lead < 0) {
    return window.subarray(0, 0);
  }

  const byte = window[lead];
  const width = byte >= 0xf0 ? 4 : byte >= 0xe0 ? 3 : byte >= 0xc0 ? 2 : 1;

  // Keep the trailing sequence only when the cut did not land inside it.
  return lead + width <= window.length ? window : window.subarray(0, lead);
}

/**
 * Render part of a message for an error message. A v8 payload is binary, so it
 * is rendered as hex: decoding it as utf8 replaces every byte above 0x7f with
 * U+FFFD, starting with the 0xFF header that identifies the format.
 */
export function describeMessage(
  message: Buffer,
  { maxBytes = 300, from = 'start' }: DescribeMessageOptions = {}
): string {
  const json = isJsonMessage(message);
  const window =
    from === 'end'
      ? message.subarray(Math.max(0, message.length - maxBytes))
      : message.subarray(0, maxBytes);
  const slice = json ? trimToCharBoundary(window, from) : window;
  const elided = message.length - slice.length;

  return [
    `${json ? 'json' : 'v8'}, ${message.length} bytes` +
      (elided > 0
        ? `, ${from === 'end' ? 'last' : 'first'} ${slice.length} shown`
        : ''),
    json ? slice.toString('utf8') : slice.toString('hex'),
  ].join('\n');
}

export interface DescribeMessageOptions {
  maxBytes?: number;
  from?: 'start' | 'end';
}

/**
 * Parse a message produced by `serialize()` in `daemon/socket-utils.ts`.
 */
export function parseMessage<T = unknown>(message: Buffer): T {
  return isJsonMessage(message)
    ? JSON.parse(message.toString('utf8'))
    : deserialize(message);
}
