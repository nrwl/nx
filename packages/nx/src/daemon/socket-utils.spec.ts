import type { Socket } from 'net';
import type { Mock } from 'vitest';
import { win32 } from 'node:path';
import { deserialize as v8_deserialize } from 'v8';
import {
  getPluginOsSocketPath,
  getPluginSocketFileName,
  sendMessage,
  serialize,
  serializeWithFallback,
} from './socket-utils';
import {
  getPluginSocketDir,
  getRefusedConfiguredSocketDir,
  getSocketDirFallbackCause,
} from './tmp-dir';

vi.mock('./tmp-dir', () => ({
  getDaemonSocketDir: vi.fn(),
  getPluginSocketDir: vi.fn(),
  getSocketDir: vi.fn(),
  getSocketDirFallbackCause: vi.fn(),
  getRefusedConfiguredSocketDir: vi.fn(),
}));

describe('socket path validation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the plugin socket basename prefix and suffix short', () => {
    expect(getPluginSocketFileName('123-0-12345678')).toBe(
      'p123-0-12345678.sock'
    );
  });

  it('keeps the plugin socket within the current Windows budget for an 18-character username', () => {
    const windowsTempDir = win32.join(
      'C:\\Users',
      'u'.repeat(18),
      'AppData\\Local\\Temp'
    );
    const pluginSocketPath = win32.join(
      windowsTempDir,
      'f'.repeat(8),
      getPluginSocketFileName('9999999999-z-ffffffff')
    );

    expect(pluginSocketPath).toHaveLength(83);
    expect(pluginSocketPath.length).toBeLessThanOrEqual(95);
  });

  it('attaches the default-directory failure when its fallback is too long', () => {
    const cause = new Error('unsafe default socket root');
    (getPluginSocketDir as Mock).mockReturnValue(`/${'a'.repeat(96)}`);
    (getSocketDirFallbackCause as Mock).mockReturnValue(cause);

    let thrown!: Error;
    try {
      getPluginOsSocketPath('123-0-12345678');
      throw new Error('Expected socket path validation to fail');
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown.message).toContain('Nx fell back');
    expect(thrown.message).toContain('--verbose');
    expect(thrown.cause).toBe(cause);
  });

  it('does not claim an explicit short-path remedy was a fallback', () => {
    (getPluginSocketDir as Mock).mockReturnValue(`/${'a'.repeat(96)}`);
    (getSocketDirFallbackCause as Mock).mockReturnValue(undefined);

    expect(() => getPluginOsSocketPath('123-0-12345678')).toThrow(
      'Set NX_SOCKET_DIR to a shorter path'
    );

    try {
      getPluginOsSocketPath('123-0-12345678');
    } catch (error) {
      expect((error as Error).message).not.toContain('Nx fell back');
      expect((error as Error).cause).toBeUndefined();
    }
  });

  it('stops advising a shorter NX_SOCKET_DIR once the configured one was refused', () => {
    // They already set one, and it was rejected for a reason that has nothing
    // to do with length — a read-only mount, EACCES, a directory they do not
    // own. Repeating the generic advice sends them round in a circle.
    (getPluginSocketDir as Mock).mockReturnValue(`/${'a'.repeat(96)}`);
    (getSocketDirFallbackCause as Mock).mockReturnValue(undefined);
    (getRefusedConfiguredSocketDir as Mock).mockReturnValue(
      '/mnt/read-only/sockets'
    );

    try {
      getPluginOsSocketPath('123-0-12345678');
      throw new Error('Expected socket path validation to fail');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('/mnt/read-only/sockets');
      expect(message).toContain('could not be used');
      expect(message).not.toContain('Set NX_SOCKET_DIR to a shorter path');
    }
  });
});

describe('serializeWithFallback', () => {
  // JSON.stringify throws on a BigInt; v8 serializes it fine.
  const jsonHostile = { value: 1n };
  // v8 refuses to clone a function; JSON.stringify silently drops it.
  const v8Hostile = { fn: () => {} };

  const asJson = (serialized: Buffer) => serialized.toString('utf8');

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('uses the preferred format when it can represent the data', () => {
    expect(asJson(serializeWithFallback({ a: 1 }, 'json'))).toBe('{"a":1}');
    expect(v8_deserialize(serializeWithFallback({ a: 1 }, 'v8'))).toEqual({
      a: 1,
    });
  });

  it('falls back to v8 when JSON serialization fails', () => {
    expect(v8_deserialize(serializeWithFallback(jsonHostile, 'json'))).toEqual(
      jsonHostile
    );
  });

  it('falls back to JSON when v8 serialization fails', () => {
    expect(asJson(serializeWithFallback(v8Hostile, 'v8'))).toBe('{}');
  });

  it('emits v8 bytes directly rather than a binary string', () => {
    // The daemon writes this straight to the socket. Round-tripping through
    // `.toString('binary')` reintroduced the max-string-length ceiling the
    // fallback exists to avoid.
    const serialized = serializeWithFallback({ a: 1 }, 'v8');
    expect(Buffer.isBuffer(serialized)).toBe(true);
    expect(serialized[0]).toBe(0xff);
  });

  it('reports the preferred format failure before falling back', () => {
    serializeWithFallback(jsonHostile, 'json');

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Do not know how to serialize a BigInt')
    );
  });

  it('throws when neither format can represent the data', () => {
    const circularWithFunction: any = { fn: () => {} };
    circularWithFunction.self = circularWithFunction;

    expect(() => serializeWithFallback(circularWithFunction, 'json')).toThrow(
      'could not be cloned'
    );
  });
});

describe('serialize', () => {
  const jsonHostile = { value: 1n };

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('does not fall back when a format is forced', () => {
    // `processInBackground` forces JSON because its payloads cannot be cloned
    // by v8 - silently switching formats there would trade one failure for
    // another, less obvious one.
    expect(() => serialize(jsonHostile, 'json')).toThrow(
      'Do not know how to serialize a BigInt'
    );
    expect(() => serialize({ fn: () => {} }, 'v8')).toThrow(
      'could not be cloned'
    );
  });

  it('honours a forced format when the v8 serializer is enabled', () => {
    const previous = process.env.NX_USE_V8_SERIALIZER;
    process.env.NX_USE_V8_SERIALIZER = 'true';

    try {
      expect(serialize({ a: 1 }, 'json').toString('utf8')).toBe('{"a":1}');
    } finally {
      if (previous === undefined) {
        delete process.env.NX_USE_V8_SERIALIZER;
      } else {
        process.env.NX_USE_V8_SERIALIZER = previous;
      }
    }
  });
});

describe('sendMessage', () => {
  it('frames the serialized payload as one message', () => {
    const writes: Buffer[] = [];
    const socket = {
      write: (data: Buffer) => writes.push(data),
    } as unknown as Socket;

    sendMessage(socket, { a: 1 }, 'json');

    const [header, payload] = writes;
    expect(header.toString('ascii')).toBe(`NX_MSG_${payload.length}:`);
    expect(payload.toString('utf8')).toBe('{"a":1}');
  });

  it('passes the forced format through to the serializer', () => {
    const writes: Buffer[] = [];
    const socket = {
      write: (data: Buffer) => writes.push(data),
    } as unknown as Socket;

    sendMessage(socket, { a: 1 }, 'v8');

    expect(writes[1][0]).toBe(0xff);
  });
});
