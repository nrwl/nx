import { createRequire } from 'node:module';
import { join } from 'node:path';
import type * as LoadTsTransformers from './load-ts-transformers';

// The source reads `module.paths`, which vitest's ESM module shim lacks, and
// `require()`s each plugin, so load it on the CJS channel and resolve plugins
// straight to the fixtures in `__mocks__`.
const { loadTsTransformers } = createRequire(import.meta.url)(
  './load-ts-transformers'
) as typeof LoadTsTransformers;
const mockRequireResolve = vi.fn((name: string) =>
  join(import.meta.dirname, '__mocks__', `${name}.ts`)
);

describe('loadTsTransformers', () => {
  it('should return empty hooks if plugins is falsy', () => {
    const result = loadTsTransformers(undefined);
    assertEmptyResult(result);
  });

  it('should return empty hooks if plugins is []', () => {
    const result = loadTsTransformers([]);
    assertEmptyResult(result);
  });

  it('should return correct compiler hooks', () => {
    const result = loadTsTransformers(
      ['plugin-a', 'plugin-b'],
      mockRequireResolve as any
    );

    expect(result.hasPlugin).toEqual(true);
    expect(result.compilerPluginHooks).toEqual({
      beforeHooks: [expect.any(Function)],
      afterHooks: [expect.any(Function)],
      afterDeclarationsHooks: [],
    });
  });

  it('should handle function-based after transformers', () => {
    const result = loadTsTransformers(
      ['function-after-plugin'],
      mockRequireResolve as any
    );

    expect(result.hasPlugin).toEqual(true);
    expect(result.compilerPluginHooks).toEqual({
      beforeHooks: [],
      afterHooks: [expect.any(Function)],
      afterDeclarationsHooks: [],
    });
  });

  it('should handle function-based afterDeclarations transformers', () => {
    const result = loadTsTransformers(
      ['function-after-declarations-plugin'],
      mockRequireResolve as any
    );

    expect(result.hasPlugin).toEqual(true);
    expect(result.compilerPluginHooks).toEqual({
      beforeHooks: [],
      afterHooks: [],
      afterDeclarationsHooks: [expect.any(Function)],
    });
  });

  it('should handle direct function export transformers', () => {
    const result = loadTsTransformers(
      ['function-direct-export'],
      mockRequireResolve as any
    );

    expect(result.hasPlugin).toEqual(true);
    expect(result.compilerPluginHooks).toEqual({
      beforeHooks: [expect.any(Function)],
      afterHooks: [],
      afterDeclarationsHooks: [],
    });
  });

  it('should handle function-based transformers with multiple hooks', () => {
    const result = loadTsTransformers(
      ['function-multiple-hooks'],
      mockRequireResolve as any
    );

    expect(result.hasPlugin).toEqual(true);
    expect(result.compilerPluginHooks).toEqual({
      beforeHooks: [expect.any(Function)],
      afterHooks: [expect.any(Function)],
      afterDeclarationsHooks: [expect.any(Function)],
    });
  });

  function assertEmptyResult(result: ReturnType<typeof loadTsTransformers>) {
    expect(result.hasPlugin).toEqual(false);
    expect(result.compilerPluginHooks).toEqual({
      beforeHooks: [],
      afterHooks: [],
      afterDeclarationsHooks: [],
    });
  }
});
