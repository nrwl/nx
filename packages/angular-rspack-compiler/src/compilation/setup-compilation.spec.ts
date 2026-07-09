import { describe, expect, it, vi } from 'vitest';
import { loadCompilerCli } from '../utils';
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

  it('should raise targets below ES2022 and warn about it', async () => {
    // The mocked readConfiguration echoes the existing options, which carry
    // no target, so the ES2022 forcing applies.
    const { compilerOptions, setupWarnings } = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options
    );

    expect(compilerOptions.target).toBe(9 /* ts.ScriptTarget.ES2022 */);
    expect(compilerOptions.useDefineForClassFields).toBe(false);
    expect(setupWarnings).toEqual([
      expect.stringContaining(
        "'target' and 'useDefineForClassFields' are set to 'ES2022' and 'false'"
      ),
    ]);
  });

  it('should not warn when the target is already ES2022', async () => {
    vi.mocked(loadCompilerCli).mockResolvedValueOnce({
      readConfiguration: (
        _tsconfig: string,
        existingOptions: Record<string, unknown>
      ) => ({
        options: { ...existingOptions, target: 9 },
        rootNames: ['/root/src/main.ts'],
      }),
    } as never);

    const { compilerOptions, setupWarnings } = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options
    );

    expect(compilerOptions.target).toBe(9);
    expect(compilerOptions.useDefineForClassFields).toBeUndefined();
    expect(setupWarnings).toEqual([]);
  });

  it('should warn only about the target when useDefineForClassFields is explicit', async () => {
    vi.mocked(loadCompilerCli).mockResolvedValueOnce({
      readConfiguration: (
        _tsconfig: string,
        existingOptions: Record<string, unknown>
      ) => ({
        options: {
          ...existingOptions,
          module: 99,
          target: 7 /* ES2020 */,
          useDefineForClassFields: true,
        },
        rootNames: ['/root/src/main.ts'],
      }),
    } as never);

    const { compilerOptions, setupWarnings } = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options
    );

    expect(compilerOptions.target).toBe(9);
    expect(compilerOptions.useDefineForClassFields).toBe(true);
    expect(setupWarnings).toEqual([
      "TypeScript compiler option 'target' is set to 'ES2022'.",
    ]);
  });
});
