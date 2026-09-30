import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Cache } from '@angular/build/private';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initializeAngularBuildHash } from './angular-build-hash';
import { createJavaScriptTransformer } from './javascript-transformer';

// The fixture must live on the real filesystem: the package test setup mocks
// `fs` with memfs, but the transformer and its workers read the real one.
let realFs: typeof import('node:fs');
let dir: string;

beforeAll(async () => {
  realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
  dir = realFs.mkdtempSync(join(tmpdir(), 'javascript-transformer-'));
  await initializeAngularBuildHash();
});

afterAll(() => {
  realFs.rmSync(dir, { recursive: true, force: true });
});

describe('createJavaScriptTransformer', () => {
  it('should skip the cache only in transformFileUncached', async () => {
    const file = join(dir, 'foo.mjs');
    realFs.writeFileSync(
      file,
      [
        "import * as i0 from '@angular/core';",
        'export class Foo {}',
        "Foo.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: '12.0.0', version: '22.2.0', ngImport: i0, type: Foo, providedIn: 'root' });",
        '//# sourceMappingURL=foo.mjs.map',
      ].join('\n')
    );
    const writeMap = (sourceContent: string) =>
      realFs.writeFileSync(
        `${file}.map`,
        JSON.stringify({
          version: 3,
          sources: ['foo.ts'],
          sourcesContent: [sourceContent],
          names: [],
          mappings: 'AAAA',
        })
      );
    const sourcesContent = (output: Uint8Array) => {
      const [, base64] = Buffer.from(output)
        .toString('utf8')
        .match(/sourceMappingURL=data:application\/json[^,]*,(\S+)/);
      return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
        .sourcesContent;
    };
    // One transform at a time makes the later calls queue, and each must
    // still run with its own cache behavior.
    vi.stubEnv('NG_BUILD_MAX_WORKERS', '1');
    const transformer = createJavaScriptTransformer(
      { sourcemap: true, jit: false },
      new Cache<Uint8Array>(new Map())
    );

    try {
      writeMap('old');
      await transformer.transformFile(file, false, false);
      writeMap('new');

      const outputs = await Promise.all([
        transformer.transformFile(file, false, false),
        transformer.transformFileUncached(file, false, false),
        transformer.transformData(
          file,
          realFs.readFileSync(file, 'utf8'),
          false,
          false
        ),
      ]);

      expect(outputs.map(sourcesContent)).toEqual([['old'], ['new'], ['old']]);
    } finally {
      await transformer.close();
      vi.unstubAllEnvs();
    }
  });
});
