import { emitReadySignal } from '@nx/devkit';
import { getListeningUrl } from '@nx/devkit/internal';
import { rspack, type Stats } from '@rspack/core';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { _createConfig, createConfig } from '../config/create-config';

vi.mock('@nx/devkit', async (importOriginal) => ({
  ...(await importOriginal()),
  emitReadySignal: vi.fn(() => true),
}));
vi.mock('@nx/devkit/internal', async (importOriginal) => ({
  ...(await importOriginal()),
  getListeningUrl: vi.fn(() => 'https://localhost:4200/'),
}));

describe('NgRspackPlugin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
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
      expect(emitReadySignal).not.toHaveBeenCalled();

      const address = { address: '::', family: 'IPv6', port: 4200 };
      const devServer = compiler.options.devServer || {};
      devServer.onListening?.({
        server: { address: () => address },
        options: { server: { type: 'https', options: {} } },
      });

      expect(log).toHaveBeenCalledWith('Listening on port:', 4200);
      expect(getListeningUrl).toHaveBeenCalledWith(address, true);
      expect(emitReadySignal).toHaveBeenCalledWith('https://localhost:4200/');
    } finally {
      await new Promise((resolve) => compiler.close(resolve));
    }
  });

  it('reports the dev server address of an SSR app once its server bundle loads', async () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    vi.stubEnv('RSPACK_SERVE', 'true');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = await mkdtemp(join(tmpdir(), 'ng-rspack-ssr-'));
    try {
      await mkdir(join(root, 'src'), { recursive: true });
      await writeFile(join(root, 'src', 'main.server.ts'), '');
      await writeFile(join(root, 'src', 'server.ts'), '');
      const configs = await createConfig({
        options: {
          browser: './src/main.ts',
          index: './src/index.html',
          tsConfig: './tsconfig.base.json',
          outputPath: './dist',
          deleteOutputPath: false,
          root,
          server: './src/main.server.ts',
          ssr: { entry: './src/server.ts' },
        },
      });

      const compiler = rspack(configs);
      try {
        const [browser, server] = compiler.compilers;
        (browser.options.devServer || {}).onListening?.({
          server: {
            address: () => ({ address: '::', family: 'IPv6', port: 4200 }),
          },
          options: { server: { type: 'http', options: {} } },
        });
        expect(emitReadySignal).not.toHaveBeenCalled();

        await mkdir(join(root, 'dist', 'server'), { recursive: true });
        await writeFile(join(root, 'dist', 'server', 'server.js'), '');
        await server.hooks.watchRun.promise(server);
        await server.hooks.done.promise({
          hasErrors: () => false,
          compilation: { errors: [], getAssets: () => [] },
        } as unknown as Stats);

        await vi.waitFor(() =>
          expect(emitReadySignal).toHaveBeenCalledWith(
            'https://localhost:4200/'
          )
        );
      } finally {
        await new Promise((resolve) => compiler.close(resolve));
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 10000);
});
