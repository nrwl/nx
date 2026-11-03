import type { Socket } from 'net';
import type { Mock } from 'vitest';
import { deserialize as v8_deserialize } from 'v8';
import {
  getForkedProcessOsSocketPath,
  getFullOsSocketPath,
  getPluginOsSocketPath,
  sendMessage,
  serialize,
  serializeWithFallback,
} from './socket-utils';
import {
  getDaemonSocketPath,
  getForkedProcessSocketPath,
  getPluginSocketPath,
} from './tmp-dir';

// Where a socket lives, what it is called, and whether it fits the platform's
// budget are all decided in native/utils/socket_path.rs and reported by
// tmp-dir.ts. What is left here is that each entry point asks for its own kind.
vi.mock('./tmp-dir', () => ({
  getDaemonSocketPath: vi.fn(() => '/tmp/.nx/501/sockets/abc/d.sock'),
  getForkedProcessSocketPath: vi.fn((id: string) => `/fp/${id}`),
  getPluginSocketPath: vi.fn((id: string) => `/p/${id}`),
}));

describe('socket paths', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should ask for the daemon socket', () => {
    expect(getFullOsSocketPath()).toBe('/tmp/.nx/501/sockets/abc/d.sock');
    expect(getDaemonSocketPath).toHaveBeenCalled();
  });

  it('should pass the worker id through for the per-worker sockets', () => {
    // The id is what keeps two plugin workers, or two forked tasks, off each
    // other's socket.
    expect(getPluginOsSocketPath('123-0-12345678')).toBe('/p/123-0-12345678');
    expect(getForkedProcessOsSocketPath('7')).toBe('/fp/7');

    expect(getPluginSocketPath as Mock).toHaveBeenCalledWith('123-0-12345678');
    expect(getForkedProcessSocketPath as Mock).toHaveBeenCalledWith('7');
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

    let error: Error;
    try {
      serializeWithFallback(circularWithFunction, 'json');
    } catch (e) {
      error = e;
    }

    expect(error.message).toContain(
      'Data could not be serialized using either json or v8 serialization.'
    );
    expect(error.message).toMatch(
      /json failed with: TypeError: Converting circular structure[\s\S]*\n\s+at /
    );
    expect(error.message).toMatch(
      /v8 failed with: Error: .* could not be cloned\.\n\s+at /
    );
    expect((error.cause as Error).message).toContain('could not be cloned');
  });
});

describe('serialize', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses JSON by default', () => {
    expect(serialize({ a: 1 }).toString('utf8')).toBe('{"a":1}');
  });

  it('uses v8 when the v8 serializer is enabled', () => {
    vi.stubEnv('NX_USE_V8_SERIALIZER', 'true');

    expect(v8_deserialize(serialize({ a: 1 }))).toEqual({ a: 1 });
  });

  it('falls back to v8 when JSON cannot represent the data', () => {
    expect(v8_deserialize(serialize({ value: 1n }))).toEqual({ value: 1n });
  });
});

describe('sendMessage', () => {
  it('frames the serialized payload as one message', () => {
    const writes: Buffer[] = [];
    const socket = {
      write: (data: Buffer) => writes.push(data),
    } as unknown as Socket;

    sendMessage(socket, { a: 1 });

    const [header, payload] = writes;
    expect(header.toString('ascii')).toBe(`NX_MSG_${payload.length}:`);
    expect(payload.toString('utf8')).toBe('{"a":1}');
  });
});
