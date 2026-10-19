import { mockCjsModule } from '@nx/devkit/internal-testing-utils';
import { pluginNxReadySignal } from './ready-signal-plugin';

const devkit = vi.hoisted(() => ({
  emitReadySignal: vi.fn(() => true),
}));
// The signal helpers are required lazily, which `vi.mock` cannot reach
mockCjsModule(import.meta.url, '@nx/devkit', devkit);

describe('pluginNxReadySignal', () => {
  let hooks: Record<string, (params: { port: number }) => void>;
  const api = {
    getNormalizedConfig: () => ({ server: { https: undefined } }),
    onAfterStartDevServer: (fn) => (hooks.dev = fn),
    onAfterStartPreviewServer: (fn) => (hooks.preview = fn),
  } as any;

  beforeEach(() => {
    hooks = {};
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    devkit.emitReadySignal.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('signals the port the dev or preview server started on', () => {
    pluginNxReadySignal().setup(api);
    expect(devkit.emitReadySignal).not.toHaveBeenCalled();

    hooks.dev({ port: 3000 });
    expect(devkit.emitReadySignal).toHaveBeenCalledWith(
      'http://localhost:3000/'
    );
    hooks.preview({ port: 3001 });
    expect(devkit.emitReadySignal).toHaveBeenLastCalledWith(
      'http://localhost:3001/'
    );
  });

  it.each([
    ['0.0.0.0', 'localhost'],
    ['::', 'localhost'],
    ['192.168.1.5', '192.168.1.5'],
    ['::1', '[::1]'],
  ])('reports the host the server listens on (%s)', (host, urlHost) => {
    pluginNxReadySignal().setup({
      ...api,
      getNormalizedConfig: () => ({ server: { host } }),
    });
    hooks.dev({ port: 3000 });
    expect(devkit.emitReadySignal).toHaveBeenCalledWith(
      `http://${urlHost}:3000/`
    );
  });

  it('signals the preview server through the Rsbuild 1 hook', () => {
    const { onAfterStartPreviewServer, ...v1Api } = api;
    pluginNxReadySignal().setup({
      ...v1Api,
      onAfterStartProdServer: (fn) => (hooks.preview = fn),
    });
    hooks.preview({ port: 3001 });
    expect(devkit.emitReadySignal).toHaveBeenCalledWith(
      'http://localhost:3001/'
    );
  });

  it('uses https when the server is configured for it', () => {
    pluginNxReadySignal().setup({
      ...api,
      getNormalizedConfig: () => ({ server: { https: {} } }),
    });
    hooks.dev({ port: 3000 });
    expect(devkit.emitReadySignal).toHaveBeenCalledWith(
      'https://localhost:3000/'
    );
  });

  it('does nothing outside a signalling task', () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '');
    pluginNxReadySignal().setup(api);
    expect(hooks).toEqual({});
    expect(devkit.emitReadySignal).not.toHaveBeenCalled();
  });
});
