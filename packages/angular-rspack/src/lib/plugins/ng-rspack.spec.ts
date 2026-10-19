import { signalTaskReady } from '@nx/devkit';
import { getListeningUrl } from '@nx/devkit/internal';
import { rspack } from '@rspack/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { _createConfig } from '../config/create-config';

vi.mock('@nx/devkit', async (importOriginal) => ({
  ...(await importOriginal()),
  signalTaskReady: vi.fn(() => true),
}));
vi.mock('@nx/devkit/internal', async (importOriginal) => ({
  ...(await importOriginal()),
  getListeningUrl: vi.fn(() => 'https://localhost:4200/'),
}));

describe('NgRspackPlugin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reports the dev server address once it listens, in a config @nx/rspack/plugin infers a signal for', async () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const [config] = await _createConfig({
      browser: './src/main.ts',
      index: './src/index.html',
      tsConfig: './tsconfig.base.json',
      outputPath: './dist',
      deleteOutputPath: false,
    });
    expect(
      config.plugins?.some(
        (plugin) => plugin?.[Symbol.for('@nx/ready-signal-plugin')]
      )
    ).toBe(true);

    const compiler = rspack(config);
    try {
      expect(signalTaskReady).not.toHaveBeenCalled();

      const address = { address: '::', family: 'IPv6', port: 4200 };
      const devServer = compiler.options.devServer || {};
      devServer.onListening?.({
        server: { address: () => address },
        options: { server: { type: 'https', options: {} } },
      });

      expect(log).toHaveBeenCalledWith('Listening on port:', 4200);
      expect(getListeningUrl).toHaveBeenCalledWith(address, true);
      expect(signalTaskReady).toHaveBeenCalledWith({
        url: 'https://localhost:4200/',
      });
    } finally {
      await new Promise((resolve) => compiler.close(resolve));
    }
  });
});
