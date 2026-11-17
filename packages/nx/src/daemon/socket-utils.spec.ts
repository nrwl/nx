import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'fs';
import { createServer, type Server, type Socket } from 'net';
import { platform, tmpdir } from 'os';
import { join } from 'path';
import type { Mock } from 'vitest';
import { deserialize as v8_deserialize } from 'v8';
import {
  connectToDaemonSocket,
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

(platform() === 'win32' ? describe.skip : describe)(
  'connectToDaemonSocket',
  () => {
    let base: string;
    let server: Server;
    let accepted: number;

    const listenIn = async (dir: string) => {
      const socketPath = join(dir, 'd.sock');
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(socketPath, resolve);
      });
      return socketPath;
    };

    const dial = (socketPath: string) =>
      new Promise<NodeJS.ErrnoException | null>((resolve) => {
        const socket = connectToDaemonSocket(socketPath, () => {
          socket.destroy();
          resolve(null);
        });
        socket.once('error', resolve);
      });

    beforeEach(() => {
      base = mkdtempSync(join(tmpdir(), 'nx-dial-'));
      accepted = 0;
      server = createServer((socket) => {
        accepted++;
        socket.destroy();
      });
    });

    afterEach(async () => {
      await new Promise((resolve) => server.close(resolve));
      rmSync(base, { recursive: true, force: true });
    });

    it('should connect to a socket in an owner-only directory of ours', async () => {
      expect(await dial(await listenIn(base))).toBeNull();
    });

    it('should not dial a socket whose directory belongs to another user', async () => {
      // Every level above it must stay acceptable under the faked uid, so this
      // reaches the directory's own check: root owns /tmp.
      const dir = mkdtempSync('/tmp/nx-dial-');
      const socketPath = await listenIn(dir);
      const getuid = vi
        .spyOn(process, 'getuid')
        .mockReturnValue(process.getuid!() + 1);

      try {
        const error = await dial(socketPath);

        // Not a permission errno: the client stops polling on those, and the
        // daemon it starts instead rewrites the record.
        expect(error?.code).toBe('ENOENT');
        expect(error?.message).toContain(socketPath);
        expect(error?.message).toContain('not by you');
        expect(accepted).toBe(0);
      } finally {
        getuid.mockRestore();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('should not dial a socket whose directory other users can reach', async () => {
      const socketPath = await listenIn(base);
      chmodSync(base, 0o755);

      expect((await dial(socketPath))?.code).toBe('ENOENT');
      expect(accepted).toBe(0);
    });

    it('should not dial through a symlink standing in for the directory', async () => {
      const real = join(base, 'real');
      mkdirSync(real, { mode: 0o700 });
      await listenIn(real);
      symlinkSync(real, join(base, 'link'));

      expect((await dial(join(base, 'link', 'd.sock')))?.code).toBe('ENOENT');
      expect(accepted).toBe(0);
    });

    it('should not dial when another user can swap a level above the directory', async () => {
      const shared = join(base, 'shared');
      const dir = join(shared, 'd');
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      chmodSync(shared, 0o777);
      const socketPath = await listenIn(dir);

      const error = await dial(socketPath);

      expect(error?.code).toBe('ENOENT');
      expect(error?.message).toContain(`${shared} is writable by other users`);
      expect(accepted).toBe(0);
    });

    it('should dial under a sticky level others can write, as in /tmp', async () => {
      const shared = join(base, 'shared');
      const dir = join(shared, 'd');
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      chmodSync(shared, 0o1777);

      expect(await dial(await listenIn(dir))).toBeNull();
    });

    it('should report a directory that is gone as ENOENT', async () => {
      expect((await dial(join(base, 'gone', 'd.sock')))?.code).toBe('ENOENT');
    });

    (process.getuid?.() === 0 ? it.skip : it)(
      'should keep the errno when the directory cannot be looked into',
      async () => {
        const locked = join(base, 'locked');
        mkdirSync(join(locked, 'sockets'), { recursive: true });
        chmodSync(locked, 0o000);

        try {
          expect((await dial(join(locked, 'sockets', 'd.sock')))?.code).toBe(
            'EACCES'
          );
        } finally {
          chmodSync(locked, 0o700);
        }
      }
    );
  }
);

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
