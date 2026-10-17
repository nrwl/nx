import { mockCjsModule } from '@nx/devkit/internal-testing-utils';
import {
  applyDevServerReadySignal,
  getDevServerUrl,
  NxReadySignalPlugin,
} from './dev-server-ready-signal';

const devkit = vi.hoisted(() => ({
  announceTaskReadySignal: vi.fn(() => true),
  signalTaskReady: vi.fn(() => true),
}));
// The signal helpers are required lazily, which `vi.mock` cannot reach
mockCjsModule(import.meta.url, '@nx/devkit', devkit);

describe('applyDevServerReadySignal', () => {
  beforeEach(() => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    devkit.announceTaskReadySignal.mockClear();
    devkit.signalTaskReady.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const server = {
    server: { address: () => ({ address: '::', family: 'IPv6', port: 4300 }) },
    options: { server: { type: 'http' } },
  };

  it('announces the signal and sends it once the dev server listens', () => {
    const onListening = vi.fn();
    const compiler = { options: { devServer: { onListening } } } as any;

    applyDevServerReadySignal(compiler);
    expect(devkit.announceTaskReadySignal).toHaveBeenCalled();
    expect(devkit.signalTaskReady).not.toHaveBeenCalled();

    compiler.options.devServer.onListening(server);
    expect(onListening).toHaveBeenCalledWith(server);
    expect(devkit.signalTaskReady).toHaveBeenCalledWith({
      url: 'http://localhost:4300/',
    });
  });

  it('wraps onListening when applied as the standalone plugin', () => {
    const compiler = { options: { devServer: {} } } as any;

    new NxReadySignalPlugin().apply(compiler);
    expect(devkit.announceTaskReadySignal).toHaveBeenCalled();
    expect(compiler.options.devServer.onListening).toEqual(
      expect.any(Function)
    );

    compiler.options.devServer.onListening(server);
    expect(devkit.signalTaskReady).toHaveBeenCalledWith({
      url: 'http://localhost:4300/',
    });
  });

  it('leaves the config alone outside a signalling task or without a dev server', () => {
    const compiler = { options: { devServer: {} } } as any;
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '');
    applyDevServerReadySignal(compiler);
    expect(compiler.options.devServer.onListening).toBeUndefined();

    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    const noDevServer = { options: {} } as any;
    applyDevServerReadySignal(noDevServer);
    expect(noDevServer.options.devServer).toBeUndefined();
    expect(devkit.announceTaskReadySignal).not.toHaveBeenCalled();
  });
});

describe('getDevServerUrl', () => {
  const at = (address: string, family: string, type?: unknown) =>
    getDevServerUrl({
      server: { address: () => ({ address, family, port: 4200 }) },
      options: { server: type as any },
    });

  it('builds the url from the address the server listens on', () => {
    expect(at('127.0.0.1', 'IPv4')).toBe('http://127.0.0.1:4200/');
    expect(at('::1', 'IPv6')).toBe('http://[::1]:4200/');
    expect(at('0.0.0.0', 'IPv4', 'https')).toBe('https://localhost:4200/');
    expect(at('::', 'IPv6', { type: 'spdy' })).toBe('https://localhost:4200/');
  });

  it('has no url for a socket', () => {
    expect(
      getDevServerUrl({ server: { address: () => '/tmp/dev.sock' } })
    ).toBeUndefined();
  });
});
