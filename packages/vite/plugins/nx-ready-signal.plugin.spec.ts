import { mockCjsModule } from '@nx/devkit/internal-testing-utils';
import { EventEmitter } from 'events';
import { getServerUrl, nxReadySignal } from './nx-ready-signal.plugin';

const devkit = vi.hoisted(() => ({
  announceTaskReadySignal: vi.fn(() => true),
  signalTaskReady: vi.fn(() => true),
}));
// The signal helpers are required lazily, which `vi.mock` cannot reach
mockCjsModule(import.meta.url, '@nx/devkit', devkit);

describe('nxReadySignal', () => {
  beforeEach(() => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    devkit.announceTaskReadySignal.mockClear();
    devkit.signalTaskReady.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function httpServer(port: number) {
    return Object.assign(new EventEmitter(), {
      address: () => ({ address: '127.0.0.1', family: 'IPv4', port }),
    });
  }

  it('signals the dev server address once it listens', () => {
    const server = httpServer(5173);
    (nxReadySignal().configureServer as Function)({
      httpServer: server,
      config: { server: {} },
    });
    expect(devkit.announceTaskReadySignal).toHaveBeenCalled();
    expect(devkit.signalTaskReady).not.toHaveBeenCalled();

    server.emit('listening');
    expect(devkit.signalTaskReady).toHaveBeenCalledWith({
      url: 'http://127.0.0.1:5173/',
    });
  });

  it('signals the preview server address with its protocol', () => {
    const server = httpServer(4173);
    (nxReadySignal().configurePreviewServer as Function)({
      httpServer: server,
      config: { preview: { https: {} } },
    });
    server.emit('listening');
    expect(devkit.signalTaskReady).toHaveBeenCalledWith({
      url: 'https://127.0.0.1:4173/',
    });
  });

  it('does nothing outside a signalling task or in middleware mode', () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '');
    (nxReadySignal().configureServer as Function)({
      httpServer: httpServer(1),
      config: { server: {} },
    });
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    (nxReadySignal().configureServer as Function)({
      httpServer: null,
      config: { server: {} },
    });
    expect(devkit.announceTaskReadySignal).not.toHaveBeenCalled();
  });
});

describe('getServerUrl', () => {
  it('maps a wildcard to localhost and brackets IPv6', () => {
    expect(
      getServerUrl({ address: '::', family: 'IPv6', port: 1 }, false)
    ).toBe('http://localhost:1/');
    expect(
      getServerUrl({ address: '::1', family: 'IPv6', port: 1 }, false)
    ).toBe('http://[::1]:1/');
    expect(getServerUrl('/tmp/socket', false)).toBeUndefined();
  });
});
