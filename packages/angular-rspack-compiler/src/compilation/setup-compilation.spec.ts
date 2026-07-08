import { describe, expect, it, vi } from 'vitest';
import {
  setupCompilation,
  type SetupCompilationOptions,
} from './setup-compilation';

vi.mock('../utils', () => ({
  loadCompilerCli: vi.fn().mockResolvedValue({
    readConfiguration: (
      _tsconfig: string,
      existingOptions: Record<string, unknown>
    ) => ({
      options: existingOptions,
      rootNames: ['/root/src/main.ts'],
    }),
  }),
}));

vi.mock('../utils/assert-supported-versions', () => ({
  assertSupportedAngularRspackCompilerVersions: vi.fn(),
}));

vi.mock('@angular/build/private', () => ({
  ComponentStylesheetBundler: class {},
  findTailwindConfiguration: vi.fn().mockReturnValue(undefined),
  generateSearchDirectories: vi.fn().mockResolvedValue([]),
  loadPostcssConfiguration: vi.fn().mockResolvedValue(undefined),
  getSupportedBrowsers: vi.fn().mockReturnValue([]),
}));

describe('setupCompilation', () => {
  const options: SetupCompilationOptions = {
    root: '/root',
    tsConfig: '/root/tsconfig.json',
    aot: true,
    inlineStyleLanguage: 'css',
    fileReplacements: [],
  };

  it('should not emit TS sourcemaps when script sourcemaps are disabled', async () => {
    const { compilerOptions } = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options
    );

    expect(compilerOptions.inlineSourceMap).toBe(false);
    expect(compilerOptions.inlineSources).toBe(false);
    expect(compilerOptions.sourceMap).toBeUndefined();
  });

  it('should emit inline TS sourcemaps when script sourcemaps are enabled', async () => {
    const { compilerOptions } = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      { ...options, sourceMap: true }
    );

    expect(compilerOptions.inlineSourceMap).toBe(true);
    expect(compilerOptions.inlineSources).toBe(true);
    expect(compilerOptions.sourceMap).toBeUndefined();
  });

  it('should not emit TS sourcemaps when using TS project references', async () => {
    const { compilerOptions } = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      { ...options, sourceMap: true, useTsProjectReferences: true }
    );

    expect(compilerOptions.inlineSourceMap).toBe(false);
    expect(compilerOptions.inlineSources).toBe(false);
    expect(compilerOptions.sourceMap).toBe(false);
    expect(compilerOptions.isolatedModules).toBe(true);
  });

  it.each([undefined, true])(
    'should force composite compilation off (useTsProjectReferences: %s)',
    async (useTsProjectReferences) => {
      const { compilerOptions } = await setupCompilation(
        { source: { tsconfigPath: '/root/tsconfig.json' } },
        { ...options, useTsProjectReferences }
      );

      expect(compilerOptions.composite).toBe(false);
    }
  );
});
