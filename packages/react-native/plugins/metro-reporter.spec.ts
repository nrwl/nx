import { mockCjsModule } from '@nx/devkit/internal-testing-utils';
import { createServer } from 'https';
import type { AddressInfo } from 'net';

const devkit = vi.hoisted(() => ({
  emitReadySignal: vi.fn(() => true),
}));
// The signal helpers are required lazily, which `vi.mock` cannot reach
mockCjsModule(import.meta.url, '@nx/devkit', devkit);

describe('NxMetroReporter', () => {
  const argv = process.argv;
  let terminal: { log: ReturnType<typeof vi.fn>; status: () => void };
  let reporter: { update(event: object): void };

  beforeAll(() => {
    // The reporter resolves metro from the cwd, where react-native must resolve
    vi.spyOn(process, 'cwd').mockReturnValue(__dirname);
  });

  beforeEach(() => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    devkit.emitReadySignal.mockClear();
    terminal = { log: vi.fn(), status: () => {} };
    const NxMetroReporter = require('./metro-reporter');
    reporter = new NxMetroReporter(terminal);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.argv = argv;
  });

  it("logs events like Metro's terminal reporter", () => {
    reporter.update({ type: 'bundle_save_log', message: 'saved' });
    expect(terminal.log).toHaveBeenCalledWith('LOG:saved');
  });

  it.each([
    [
      [],
      { address: '::', family: 'IPv6', port: 8081 },
      'http://localhost:8081/',
    ],
    [
      ['--https'],
      { address: '127.0.0.1', family: 'IPv4', port: 8082 },
      'https://127.0.0.1:8082/',
    ],
  ])(
    'signals the address once the server listens (args %j)',
    (args, address, url) => {
      process.argv = [...argv, 'start', ...args];
      reporter.update({ type: 'bundle_save_log', message: 'saved' });
      expect(devkit.emitReadySignal).not.toHaveBeenCalled();

      reporter.update({ type: 'server_listening', ...address });
      expect(devkit.emitReadySignal).toHaveBeenCalledExactlyOnceWith(url);
    }
  );

  it('signals an https URL for a TLS server started without --https', async () => {
    process.argv = [...argv, 'start'];
    const server = createServer({});
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const address = server.address() as AddressInfo;

    reporter.update({ type: 'server_listening', ...address });
    server.close();

    expect(devkit.emitReadySignal).toHaveBeenCalledExactlyOnceWith(
      `https://127.0.0.1:${address.port}/`
    );
  });

  it('does nothing outside a signalling task', () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '');
    reporter.update({
      type: 'server_listening',
      address: '::',
      family: 'IPv6',
      port: 8081,
    });
    expect(devkit.emitReadySignal).not.toHaveBeenCalled();
  });
});
