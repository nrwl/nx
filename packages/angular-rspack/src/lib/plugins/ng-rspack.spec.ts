import { emitReadySignal } from '@nx/devkit';
import { getListeningUrl } from '@nx/devkit/internal';
import { rspack } from '@rspack/core';
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

  it.each([
    [
      'leaves the report to an SSR server that calls emitReadySignal',
      'emitReadySignal(server);',
      true,
      undefined,
      undefined,
      0,
    ],
    [
      'reports the dev server address when the SSR server does not',
      'app.listen(4000);',
      true,
      undefined,
      undefined,
      1,
    ],
    [
      'reports the dev server address when a missing server file leaves a browser-only build',
      'emitReadySignal(server);',
      false,
      undefined,
      undefined,
      1,
    ],
    [
      'reports the dev server address when a file replacement swaps in an SSR server that does not call emitReadySignal',
      'emitReadySignal(server);',
      true,
      'app.listen(4000);',
      undefined,
      1,
    ],
    [
      'leaves the report to an SSR server that a file replacement swaps in',
      'app.listen(4000);',
      true,
      'emitReadySignal(server);',
      undefined,
      0,
    ],
    [
      'reports the dev server address when the development configuration replaces the SSR server with one that does not call emitReadySignal',
      'app.listen(4000);',
      true,
      'emitReadySignal(server);',
      'app.listen(4000);',
      1,
    ],
  ])(
    '%s',
    async (
      _,
      serverSource,
      hasServerFile,
      replacementSource,
      developmentSource,
      reports
    ) => {
      vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
      vi.stubEnv('RSPACK_SERVE', 'true');
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const root = await mkdtemp(join(tmpdir(), 'ng-rspack-ssr-'));
      try {
        await mkdir(join(root, 'src'), { recursive: true });
        if (hasServerFile) {
          await writeFile(join(root, 'src', 'main.server.ts'), '');
        }
        await writeFile(join(root, 'src', 'server.ts'), serverSource);
        if (replacementSource !== undefined) {
          await writeFile(
            join(root, 'src', 'server.replaced.ts'),
            replacementSource
          );
        }
        if (developmentSource !== undefined) {
          await writeFile(
            join(root, 'src', 'server.development.ts'),
            developmentSource
          );
        }
        const [config] = await createConfig(
          {
            options: {
              browser: './src/main.ts',
              index: './src/index.html',
              tsConfig: './tsconfig.base.json',
              outputPath: './dist',
              deleteOutputPath: false,
              root,
              server: './src/main.server.ts',
              ssr: { entry: './src/server.ts' },
              fileReplacements:
                replacementSource === undefined
                  ? []
                  : [
                      {
                        replace: './src/server.ts',
                        with: './src/server.replaced.ts',
                      },
                    ],
            },
          },
          developmentSource === undefined
            ? {}
            : {
                development: {
                  options: {
                    fileReplacements: [
                      {
                        replace: './src/server.ts',
                        with: './src/server.development.ts',
                      },
                    ],
                  },
                },
              }
        );

        const compiler = rspack(config);
        try {
          (compiler.options.devServer || {}).onListening?.({
            server: {
              address: () => ({ address: '::', family: 'IPv6', port: 4200 }),
            },
            options: { server: { type: 'http', options: {} } },
          });

          expect(emitReadySignal).toHaveBeenCalledTimes(reports);
        } finally {
          await new Promise((resolve) => compiler.close(resolve));
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    10000
  );
});
