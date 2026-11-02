import type { ExecutorContext } from '@nx/devkit';
import { mockCjsModule } from '@nx/devkit/internal-testing-utils';
import { fork } from 'child_process';
import type { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { VerdaccioExecutorSchema } from './schema';
import verdaccioExecutor from './verdaccio.impl';

const devkit = vi.hoisted(() => ({
  emitReadySignal: vi.fn((_url?: string) => true),
}));
// The signal API is required lazily, which `vi.mock` cannot reach
mockCjsModule(import.meta.url, '@nx/devkit', devkit);

const verdaccio = vi.hoisted(() => ({
  children: [] as Array<EventEmitter & { kill: ReturnType<typeof vi.fn> }>,
}));
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const { EventEmitter } = await import('node:events');
  return {
    ...actual,
    fork: vi.fn(() => {
      const child = Object.assign(new EventEmitter(), { kill: vi.fn() });
      verdaccio.children.push(child);
      return child;
    }),
  };
});

const detectPort = vi.hoisted(() => vi.fn<(port: number) => Promise<number>>());
vi.mock('detect-port', () => ({ default: detectPort }));

// The executor resolves verdaccio from `module.paths`, which vitest leaves empty
vi.mock('@nx/devkit/internal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nx/devkit/internal')>();
  return {
    ...actual,
    readModulePackageJson: (specifier: string) =>
      actual.readModulePackageJson(specifier, [__dirname]),
  };
});

// Verdaccio's own `--listen` parser, which picks the host and port it binds
const { getListenAddress } = createRequire(
  require.resolve('verdaccio/package.json')
)('@verdaccio/config');

const processEvents = ['exit', 'SIGTERM', 'SIGINT', 'SIGHUP'];
// `NodeJS.Process` types listeners per event, which rules out a variable name
const processEmitter: EventEmitter = process;

describe('Verdaccio readiness', () => {
  let existingListeners: Map<string, Function[]>;
  let run: Promise<unknown> | undefined;

  beforeEach(() => {
    existingListeners = new Map(
      processEvents.map((event) => [event, processEmitter.listeners(event)])
    );
  });

  afterEach(async () => {
    for (const child of verdaccio.children) child.emit('exit', 0, null);
    await run;
    run = undefined;
    verdaccio.children.length = 0;
    // The executor never removes its listeners
    for (const event of processEvents) {
      for (const added of addedListeners(event)) {
        processEmitter.removeListener(event, added as () => void);
      }
    }
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function addedListeners(event: string) {
    return processEmitter
      .listeners(event)
      .filter((existing) => !existingListeners.get(event).includes(existing));
  }

  const settle = () => new Promise((resolve) => setImmediate(resolve));

  async function start(
    options: Partial<VerdaccioExecutorSchema>,
    { freePort = 4873 } = {}
  ) {
    detectPort.mockResolvedValue(freePort);
    const settled = vi.fn();
    run = verdaccioExecutor(
      {
        location: 'none',
        listenAddress: 'localhost',
        config: 'config.yml',
        port: 4873,
        ...options,
      },
      { root: '/workspace' } as ExecutorContext
    ).finally(settled);
    await settle();
    expect(verdaccio.children).toHaveLength(1);
    return { child: verdaccio.children[0], settled, result: run };
  }

  it.each([
    ['localhost', 'localhost:4874', 'localhost', 'http://localhost:4874/'],
    ['127.0.0.1', '127.0.0.1:4874', '127.0.0.1', 'http://127.0.0.1:4874/'],
    [
      'http://127.0.0.1',
      'http://127.0.0.1:4874',
      '127.0.0.1',
      'http://127.0.0.1:4874/',
    ],
    [
      'http:127.0.0.1',
      'http:127.0.0.1:4874',
      '127.0.0.1',
      'http://127.0.0.1:4874/',
    ],
    ['', '4874', 'localhost', 'http://localhost:4874/'],
    ['http:', 'http::4874', 'localhost', 'http://localhost:4874/'],
    ['http://', 'http://:4874', 'localhost', 'http://localhost:4874/'],
    ['0.0.0.0', '0.0.0.0:4874', '0.0.0.0', 'http://127.0.0.1:4874/'],
    ['[::]', '[::]:4874', '::', 'http://[::1]:4874/'],
  ])(
    'starts %j on the fallback port and reports where Verdaccio listens once it has started',
    async (listenAddress, listen, host, url) => {
      vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
      const { child } = await start({ listenAddress }, { freePort: 4874 });

      expect(vi.mocked(fork).mock.calls[0][1]).toEqual([
        '--config',
        join('/workspace', 'config.yml'),
        '--listen',
        listen,
      ]);
      expect(getListenAddress(listen, console)).toEqual({
        proto: 'http',
        host,
        port: '4874',
      });
      expect(devkit.emitReadySignal).not.toHaveBeenCalled();

      child.emit('message', { verdaccio_started: true });

      expect(devkit.emitReadySignal).toHaveBeenCalledTimes(1);
      expect(devkit.emitReadySignal).toHaveBeenCalledWith(url);
    }
  );

  it('signals readiness without a URL for a scoped IPv6 listener', async () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    const { child } = await start({ listenAddress: '[::1%lo0]' });

    child.emit('message', { verdaccio_started: true });

    expect(devkit.emitReadySignal).toHaveBeenCalledWith(undefined);
  });

  it('does not report readiness when Verdaccio fails to start', async () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    const { child, result } = await start({});

    child.emit('exit', 1, null);

    await expect(result).resolves.toMatchObject({ success: false });
    expect(devkit.emitReadySignal).not.toHaveBeenCalled();
  });

  it('does not signal when the task does not wait for readiness', async () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '');
    const { child } = await start({});

    child.emit('message', { verdaccio_started: true });

    expect(devkit.emitReadySignal).not.toHaveBeenCalled();
  });

  it('keeps running while Verdaccio runs and stops it with the signal its process receives', async () => {
    const { child, settled } = await start({});
    child.emit('message', { verdaccio_started: true });
    await settle();
    expect(settled).not.toHaveBeenCalled();

    for (const listener of addedListeners('SIGTERM')) listener('SIGTERM');

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
