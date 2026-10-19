import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ssrServerEmitsReadySignal } from './dev-server-ready-signal';

describe('ssrServerEmitsReadySignal', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ssr-ready-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('is true when the SSR entry calls emitReadySignal', () => {
    writeFileSync(
      join(root, 'server.ts'),
      `(await import(nxDevkit)).emitReadySignal(server);`
    );

    expect(ssrServerEmitsReadySignal(root, { entry: './server.ts' })).toBe(
      true
    );
  });

  it('is false when the SSR entry does not report readiness', () => {
    writeFileSync(join(root, 'server.ts'), `app.listen(4000);`);

    expect(ssrServerEmitsReadySignal(root, { entry: './server.ts' })).toBe(
      false
    );
  });

  it('is false without an SSR entry, or when it cannot be read', () => {
    expect(ssrServerEmitsReadySignal(root, undefined)).toBe(false);
    expect(ssrServerEmitsReadySignal(root, true)).toBe(false);
    expect(ssrServerEmitsReadySignal(root, { entry: './missing.ts' })).toBe(
      false
    );
  });
});
