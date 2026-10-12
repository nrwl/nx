import * as rspackV1 from '@rspack/core';
import type { Stats } from '@rspack/core';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { NormalizedAngularRspackPluginOptions } from '../../models';

describe('getOptimization', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'angular-rspack-optimization-'));
    writeFileSync(
      join(dir, 'index.js'),
      `
        function wrap(cb) { return () => cb(); }
        class C { static n = 0; id = ++C.n; v = wrap(() => this.id); }
        console.log([new C(), new C(), new C()].map((c) => c.v()).join(','));
      `
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.doUnmock('@rspack/core');
    vi.resetModules();
  });

  async function minifyAndRun(
    rspackCore: typeof import('@rspack/core'),
    platform: 'browser' | 'server'
  ) {
    vi.doMock('@rspack/core', () => rspackCore);
    const { getOptimization } = await import('./optimization-config.js');
    const { minimizer } = getOptimization(
      {
        optimization: { scripts: true },
      } as NormalizedAngularRspackPluginOptions,
      platform
    );

    const outDir = join(dir, `out-${rspackCore.rspackVersion}-${platform}`);
    const compiler = rspackCore.rspack({
      mode: 'production',
      context: dir,
      entry: './index.js',
      target: [platform === 'browser' ? 'web' : 'node', 'es2015'],
      output: { path: outDir, filename: 'main.js' },
      devtool: false,
      optimization: { minimize: true, minimizer },
    });
    const stats = await new Promise<Stats>((res, rej) => {
      compiler.run((err, stats) => {
        compiler.close((closeErr) => {
          if (err || closeErr) {
            rej(err ?? closeErr);
          } else if (stats.hasErrors()) {
            rej(new Error(stats.toString({ errors: true, all: false })));
          } else {
            res(stats);
          }
        });
      });
    });
    const mainAsset = stats.compilation.getAsset('main.js');
    expect(mainAsset && mainAsset.info.minimized).toBe(true);

    const logs: string[] = [];
    runInNewContext(readFileSync(join(outDir, 'main.js'), 'utf8'), {
      console: { log: (message: string) => logs.push(message) },
    });
    return logs;
  }

  it.each(['browser', 'server'] as const)(
    'should keep per-instance closures from class field initializers when minifying for the %s',
    async (platform) => {
      expect(await minifyAndRun(rspackV1, platform)).toEqual(['1,2,3']);
    }
  );

  it.each(['browser', 'server'] as const)(
    'should keep per-instance closures from class field initializers when minifying for the %s with rspack v2',
    async (platform) => {
      // This package resolves rspack v1; the workspace root resolves v2.
      const workspaceRequire = createRequire(
        join(__dirname, '../../../../../../package.json')
      );
      const rspackV2 = (await import(
        pathToFileURL(workspaceRequire.resolve('@rspack/core')).href
      )) as typeof import('@rspack/core');
      expect(rspackV2.rspackVersion).toMatch(/^2\./);

      expect(await minifyAndRun(rspackV2, platform)).toEqual(['1,2,3']);
    }
  );
});
