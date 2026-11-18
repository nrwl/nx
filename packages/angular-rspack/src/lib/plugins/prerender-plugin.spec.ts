import { rspack, type Stats } from '@rspack/core';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

const extractRoutes = vi.hoisted(() => vi.fn<() => Promise<unknown>>());

vi.mock('./tools/worker-pool', () => ({
  WorkerPool: class {
    constructor(private readonly options: { filename: string }) {}

    run() {
      return this.options.filename.includes('routes-extractor-worker')
        ? extractRoutes()
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
        optimization: { styles: { minify: false, inlineCritical: false } },
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

  function readPrerenderedRoutes() {
    return JSON.parse(
      readFileSync(join(directory, 'prerendered-routes.json'), 'utf8')
    );
  }

  it.each([
    [
      'an error',
      new Error('server bundle failed to load'),
      'server bundle failed to load',
    ],
    [
      'a thrown string',
      'server bundle failed to load',
      'server bundle failed to load',
    ],
    [
      'an object with a message',
      { message: 'server bundle failed to load' },
      'server bundle failed to load',
    ],
    [
      'an object that cannot be converted to a string',
      { status: 503, toString: null },
      'Prerendering failed with a value that cannot be converted to a string.',
    ],
  ])(
    'reports a route extraction that fails with %s as a build error',
    async (_, failure, message) => {
      extractRoutes.mockRejectedValue(failure);

      expect(await buildErrors({ discoverRoutes: true })).toEqual([
        expect.stringContaining(message),
      ]);
    }
  );

  it('builds without errors when there are no routes to prerender', async () => {
    expect(await buildErrors({ discoverRoutes: false })).toEqual([]);
    expect(readPrerenderedRoutes()).toEqual({ routes: {} });
  });

  it('reports route validation errors and prerenders no routes', async () => {
    extractRoutes.mockResolvedValue({
      routes: ['home'],
      errors: [
        "The 'invalid' server route does not match any routes.",
        "Invalid '/x' route configuration: the path cannot start with a slash.",
      ],
    });

    expect(
      await buildErrors({ discoverRoutes: true, routes: ['about'] })
    ).toEqual([
      expect.stringContaining(
        "The 'invalid' server route does not match any routes."
      ),
      expect.stringContaining(
        "Invalid '/x' route configuration: the path cannot start with a slash."
      ),
    ]);
    expect(readPrerenderedRoutes()).toEqual({ routes: {} });
  });
});
