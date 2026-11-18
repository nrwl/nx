import { rspack, type Stats } from '@rspack/core';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { NormalizedAngularRspackPluginOptions } from '../models';
import { PrerenderPlugin } from './prerender-plugin';

const routeExtraction = vi.hoisted(() => ({ failure: undefined as unknown }));

vi.mock('./tools/worker-pool', () => ({
  WorkerPool: class {
    constructor(private readonly options: { filename: string }) {}

    run() {
      // A server bundle that throws while loading fails the route extraction.
      return this.options.filename.includes('routes-extractor-worker')
        ? Promise.reject(routeExtraction.failure)
        : Promise.resolve({});
    }

    destroy() {
      return Promise.resolve();
    }
  },
}));

describe('PrerenderPlugin', () => {
  let directory: string;

  // The plugin require.resolve()s its worker files, which exist only as .ts
  // sources here. The mocked pool never loads them.
  beforeAll(() => {
    require.extensions['.ts'] = require.extensions['.js'];
  });

  afterAll(() => {
    delete require.extensions['.ts'];
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  async function buildErrors(
    prerender: NormalizedAngularRspackPluginOptions['prerender']
  ): Promise<string[]> {
    directory = mkdtempSync(join(tmpdir(), 'nx-angular-rspack-prerender-'));
    writeFileSync(join(directory, 'main.js'), 'export {};');
    mkdirSync(join(directory, 'server'));
    writeFileSync(join(directory, 'server', 'server.js'), '');
    const compiler = rspack({
      mode: 'development',
      context: directory,
      entry: './main.js',
      output: { path: join(directory, 'out') },
    });
    new PrerenderPlugin(
      {
        outputPath: {
          base: directory,
          browser: join(directory, 'browser'),
          server: join(directory, 'server'),
        },
        index: { input: 'index.html', output: 'index.html' },
        prerender,
        zoneless: true,
      } as NormalizedAngularRspackPluginOptions,
      undefined,
      {
        current: {
          indexHtml: new Map([
            [
              '',
              {
                server: '<html></html>',
                csr: '<html></html>',
                nonce: undefined,
              },
            ],
          ]),
          criticalCssPlans: undefined,
        },
      }
    ).apply(compiler);

    try {
      const stats = await new Promise<Stats>((resolve, reject) => {
        compiler.run((error, stats) =>
          error ? reject(error) : resolve(stats!)
        );
      });
      return stats.compilation.errors.map((error) => error.message);
    } finally {
      await new Promise<void>((resolve, reject) => {
        compiler.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }

  it.each([
    ['an error', new Error('server bundle failed to load')],
    ['a thrown string', 'server bundle failed to load'],
  ])(
    'reports a route extraction that fails with %s as a build error',
    async (_, failure) => {
      routeExtraction.failure = failure;

      expect(await buildErrors({ discoverRoutes: true })).toEqual([
        expect.stringContaining('server bundle failed to load'),
      ]);
    }
  );
});
