import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

const { dir, serverBundlePath } = vi.hoisted(() => {
  const { mkdtempSync } = require('node:fs') as typeof import('node:fs');
  const { tmpdir } = require('node:os') as typeof import('node:os');
  const { join } = require('node:path') as typeof import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'ng-rspack-routes-extractor-'));

  return { dir, serverBundlePath: join(dir, 'server.js') };
});

vi.mock('node:worker_threads', () => ({
  workerData: {
    zonePackage: false,
    indexFile: 'index.html',
    outputPath: dir,
    serverBundlePath,
  },
}));

describe('routes-extractor-worker', () => {
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('should bootstrap from the re-exported main.server entry when the bundle has no default export', async () => {
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    // The server bundle rspack emits for an application-engine entry: the
    // platform-server-exports loader re-exports the main.server bootstrap
    // under __ngRspackMainServerBootstrap and the entry has no default.
    writeFileSync(
      serverBundlePath,
      `const bootstrap = function mainServerBootstrap() {};
exports.__ngRspackMainServerBootstrap = bootstrap;
exports['\\u0275getRoutesFromAngularRouterConfig'] = (received) => {
  globalThis.__ngRspackReceivedBootstrap = received;
  return Promise.resolve({
    routes: [
      { route: '/' },
      { route: '/redirected', redirectTo: '/' },
      { route: '/product/:id' },
    ],
  });
};`
    );

    const worker: any = await import('./routes-extractor-worker.js');
    const extract = await worker.default;

    await expect(extract()).resolves.toStrictEqual(['/']);
    expect((globalThis as any).__ngRspackReceivedBootstrap).toBe(
      require(serverBundlePath).__ngRspackMainServerBootstrap
    );
  });
});
