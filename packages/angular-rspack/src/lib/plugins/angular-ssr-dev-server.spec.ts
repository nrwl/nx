import type { Compiler } from '@rspack/core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./server/ssr-reload-server', () => ({
  SsrReloadServer: class {
    sendReload = vi.fn();
  },
}));

import { AngularSsrDevServer } from './angular-ssr-dev-server';

type Tap = (...args: any[]) => unknown;

function createHook() {
  const taps: Tap[] = [];
  return {
    taps,
    tap: (_name: string, fn: Tap) => taps.push(fn),
    tapAsync: (_name: string, fn: Tap) => taps.push(fn),
  };
}

describe('AngularSsrDevServer', () => {
  it('should register the afterEmit hook only once across rebuilds', async () => {
    const hooks = {
      entryOption: createHook(),
      watchRun: createHook(),
      afterEmit: createHook(),
    };
    const compiler = { hooks } as unknown as Compiler;
    new AngularSsrDevServer({
      outputPath: { browser: '/dist/browser', server: '/dist/server' },
      index: 'src/index.html',
    } as any).apply(compiler);

    // watchRun fires before the initial build and before every rebuild.
    for (let build = 0; build < 3; build++) {
      for (const fn of hooks.watchRun.taps) {
        await new Promise<void>((resolve) => fn(compiler, () => resolve()));
      }
    }

    expect(hooks.watchRun.taps).toHaveLength(1);
    expect(hooks.afterEmit.taps).toHaveLength(1);
  });
});
