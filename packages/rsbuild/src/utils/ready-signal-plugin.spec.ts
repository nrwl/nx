import { mockCjsModule } from '@nx/devkit/internal-testing-utils';
import { pluginNxReadySignal } from './ready-signal-plugin';

const devkit = vi.hoisted(() => ({
  signalTaskReady: vi.fn(() => true),
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
    devkit.signalTaskReady.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('signals the port the dev or preview server started on', () => {
    pluginNxReadySignal().setup(api);
    expect(devkit.signalTaskReady).not.toHaveBeenCalled();

    hooks.dev({ port: 3000 });
    expect(devkit.signalTaskReady).toHaveBeenCalledWith({
      url: 'http://localhost:3000/',
    });
    hooks.preview({ port: 3001 });
    expect(devkit.signalTaskReady).toHaveBeenLastCalledWith({
      url: 'http://localhost:3001/',
    });
  });

  it('uses https when the server is configured for it', () => {
    pluginNxReadySignal().setup({
      ...api,
      getNormalizedConfig: () => ({ server: { https: {} } }),
    });
    hooks.dev({ port: 3000 });
    expect(devkit.signalTaskReady).toHaveBeenCalledWith({
      url: 'https://localhost:3000/',
    });
  });

  it('does nothing outside a signalling task', () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '');
    pluginNxReadySignal().setup(api);
    expect(hooks).toEqual({});
    expect(devkit.signalTaskReady).not.toHaveBeenCalled();
  });
});
