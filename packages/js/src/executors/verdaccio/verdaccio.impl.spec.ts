import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
// eslint-disable-next-line no-restricted-imports -- Receive real readiness messages without adding a test-only API.
import { ReadySignalServer } from 'nx/src/tasks-runner/readiness/ready-signal-server';

describe('Verdaccio readiness', () => {
  const ipv6Loopback = Object.entries(networkInterfaces()).find(
    ([, addresses]) =>
      addresses?.some(({ internal, family }) => internal && family === 'IPv6')
  )?.[0];
  let root: string;
  let signals: ReadySignalServer;
  let received: Array<{ url?: string }>;
  let child: ChildProcess;
  let listener: Server;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-verdaccio-'));
    symlinkSync(
      join(__dirname, '../../../../../node_modules'),
      join(root, 'node_modules'),
      'junction'
    );
    signals = new ReadySignalServer();
    received = [];
    signals.subscribe('registry:serve', (message) => received.push(message));
    writeFileSync(
      join(root, 'config.yml'),
      `storage: ./storage
auth:
  htpasswd:
    file: ./htpasswd
packages:
  '**':
    access: $all
    publish: $all
log: { type: stdout, format: json, level: fatal }
`
    );
  });

  afterEach(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    }
    if (listener?.listening) {
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }
    signals?.close();
    rmSync(root, { recursive: true, force: true });
  });

  async function start({
    config = 'config.yml',
    listenAddress = 'localhost',
    signal = true,
    legacyCore = false,
    occupied = true,
  } = {}) {
    listener = createServer((_, response) => response.end('unrelated'));
    listener.listen(0, 'localhost');
    await once(listener, 'listening');
    const port = (listener.address() as { port: number }).port;
    if (!occupied) {
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NX_WORKSPACE_ROOT_PATH: root,
    };
    delete env.NX_READY_SIGNAL_SOCKET;
    delete env.NX_READY_SIGNAL_TASK;
    if (signal) Object.assign(env, await signals.env('registry:serve'));
    child = spawn(
      process.execPath,
      [
        '-r',
        require.resolve('@swc-node/register'),
        '-e',
        `${
          legacyCore
            ? `const id = require.resolve('@nx/devkit');
          const devkit = require(id);
          require.cache[id].exports = Object.fromEntries(Object.entries(devkit).filter(([name]) => name !== 'emitReadySignal'));`
            : ''
        }
        require(process.argv[1]).default(JSON.parse(process.argv[2]), { root: process.argv[3] })
          .then(result => process.exit(result.success ? 0 : 1));`,
        join(__dirname, 'verdaccio.impl.ts'),
        JSON.stringify({
          port,
          listenAddress,
          location: 'none',
          config,
          storage: join(root, 'storage'),
          clear: false,
        }),
        root,
      ],
      { env }
    );
    let output = '';
    child.stdout.on('data', (data) => (output += data));
    child.stderr.on('data', (data) => (output += data));
    child.on('error', (error) => (output += error.stack));
    return { port, output: () => output };
  }

  it.each([
    ['localhost', 'localhost'],
    ['127.0.0.1', '127.0.0.1'],
    ['http://127.0.0.1', '127.0.0.1'],
    ['http:127.0.0.1', '127.0.0.1'],
    ['', 'localhost'],
    ['http:', 'localhost'],
    ['http://', 'localhost'],
    ['0.0.0.0', '127.0.0.1'],
  ])(
    'reports the owned listener for %j at its fallback port while the executor stays alive',
    async (listenAddress, hostname) => {
      const { port, output } = await start({ listenAddress });
      await vi.waitFor(
        () => {
          expect(child.exitCode, output()).toBeNull();
          expect(received, output()).toHaveLength(1);
        },
        { timeout: 15_000 }
      );

      const url = new URL(received[0].url);
      expect(url.hostname).toBe(hostname);
      expect(url.protocol).toBe('http:');
      expect(Number(url.port)).not.toBe(port);
      const response = await fetch(new URL('/-/ping', url));
      expect(response.ok).toBe(true);
      expect(await response.json()).toEqual({});
      expect(child.exitCode).toBeNull();

      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
      await expect(fetch(url)).rejects.toThrow();
    }
  );

  it('does not report readiness when startup fails despite an unrelated healthy listener', async () => {
    const { port, output } = await start({ config: 'missing.yml' });
    await vi.waitFor(() => expect(child.exitCode, output()).toBe(1), {
      timeout: 15_000,
    });
    expect(received).toEqual([]);
    expect(output()).toContain('missing.yml');
    expect(await (await fetch(`http://localhost:${port}`)).text()).toBe(
      'unrelated'
    );
  });

  it.skipIf(!ipv6Loopback)(
    'signals readiness without a URL for a scoped IPv6 listener',
    async () => {
      const { port, output } = await start({
        listenAddress: `[::1%${ipv6Loopback}]`,
        occupied: false,
      });
      await vi.waitFor(
        () => {
          expect(child.exitCode, output()).toBeNull();
          expect(received, output()).toHaveLength(1);
        },
        { timeout: 15_000 }
      );
      expect(received[0]).not.toHaveProperty('url');
      const response = await fetch(`http://[::1]:${port}/-/ping`);
      expect(response.ok).toBe(true);
      expect(await response.json()).toEqual({});
      expect(child.exitCode).toBeNull();

      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
      await expect(fetch(`http://[::1]:${port}`)).rejects.toThrow();
    }
  );

  it('keeps ordinary startup alive without a signal environment when the core has no readiness API', async () => {
    const { port, output } = await start({
      signal: false,
      legacyCore: true,
      occupied: false,
    });
    await vi.waitFor(
      async () => {
        expect(child.exitCode, output()).toBeNull();
        const response = await fetch(`http://localhost:${port}/-/ping`);
        expect(response.ok).toBe(true);
        expect(await response.json()).toEqual({});
      },
      { timeout: 15_000 }
    );
    expect(received).toEqual([]);
    expect(child.exitCode).toBeNull();
  });
});
