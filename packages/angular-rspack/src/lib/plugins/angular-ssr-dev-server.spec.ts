import { rspack } from '@rspack/core';
import { describe, expect, it } from 'vitest';
import type { NormalizedAngularRspackPluginOptions } from '../models';
import { AngularSsrDevServer } from './angular-ssr-dev-server';

describe('AngularSsrDevServer', () => {
  it('registers the afterEmit hook only once across rebuilds', async () => {
    const compiler = rspack({ mode: 'development' });
    compiler.watchMode = true;
    new AngularSsrDevServer({
      outputPath: { browser: '/dist/browser', server: '/dist/server' },
      index: { input: 'index.html', output: 'index.html' },
    } as NormalizedAngularRspackPluginOptions).apply(compiler);

    try {
      for (let build = 0; build < 3; build++) {
        await compiler.hooks.watchRun.promise(compiler);
      }
      expect(
        compiler.hooks.afterEmit.taps.filter(
          (tap) => tap.name === 'AngularSsrDevServer'
        )
      ).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        compiler.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
