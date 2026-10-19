import { mockCjsModule } from '@nx/devkit/internal-testing-utils';
import { NxAppRspackPlugin } from '../plugins/nx-app-rspack-plugin/nx-app-rspack-plugin';
import {
  applyDevServerReadySignal,
  getDevServerUrl,
  NxReadySignalPlugin,
  sendsReadySignal,
} from './dev-server-ready-signal';

const devkit = vi.hoisted(() => ({
  signalTaskReady: vi.fn(() => true),
}));
// The signal helpers are required lazily, which `vi.mock` cannot reach
mockCjsModule(import.meta.url, '@nx/devkit', devkit);

describe('applyDevServerReadySignal', () => {
  beforeEach(() => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    devkit.signalTaskReady.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const server = {
    server: { address: () => ({ address: '::', family: 'IPv6', port: 4300 }) },
    options: { server: { type: 'http' } },
  };

  it('sends the signal once the dev server listens', () => {
    const onListening = vi.fn();
    const compiler = { options: { devServer: { onListening } } } as any;

    applyDevServerReadySignal(compiler);
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
    expect(devkit.signalTaskReady).not.toHaveBeenCalled();
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

describe('sendsReadySignal', () => {
  it('finds the plugins that signal in a config with a dev server', () => {
    // As when inference loads the config
    global.NX_GRAPH_CREATION = true;
    try {
      expect(
        sendsReadySignal({ devServer: {}, plugins: [new NxAppRspackPlugin()] })
      ).toBe(true);
    } finally {
      delete global.NX_GRAPH_CREATION;
    }
    expect(
      sendsReadySignal({ devServer: {}, plugins: [new NxReadySignalPlugin()] })
    ).toBe(true);
    expect(sendsReadySignal({ devServer: {}, plugins: [{}] })).toBe(false);
    expect(sendsReadySignal({ plugins: [new NxReadySignalPlugin()] })).toBe(
      false
    );
  });
});
