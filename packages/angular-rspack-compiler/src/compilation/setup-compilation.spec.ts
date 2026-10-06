import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCompilerCli } from '../utils';
import {
  setupCompilation,
  type SetupCompilationOptions,
} from './setup-compilation';

const { isAngularBuildVersionAtLeastMock } = vi.hoisted(() => ({
  isAngularBuildVersionAtLeastMock: vi.fn((_version: string) => true),
}));

vi.mock('../utils/angular-build-version', () => ({
  isAngularBuildVersionAtLeast: isAngularBuildVersionAtLeastMock,
}));

vi.mock('../utils', () => ({
  loadCompilerCli: vi.fn().mockResolvedValue({
    readConfiguration: (
      _tsconfig: string,
      existingOptions: Record<string, unknown>
    ) => ({
      // Explicit overrides still win; existingOptions never carries module.
      options: { module: 99, ...existingOptions },
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
  afterEach(() => {
    isAngularBuildVersionAtLeastMock.mockReturnValue(true);
  });

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

  it('should not emit TS sourcemaps when using TS project references with @angular/build < 22.2', async () => {
    isAngularBuildVersionAtLeastMock.mockReturnValue(false);

    const { compilerOptions, setupWarnings } = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      { ...options, sourceMap: true, useTsProjectReferences: true }
    );

    expect(compilerOptions.inlineSourceMap).toBe(false);
    expect(compilerOptions.inlineSources).toBe(false);
    expect(compilerOptions.sourceMap).toBe(false);
    expect(compilerOptions.isolatedModules).toBe(true);
    expect(setupWarnings).not.toContainEqual(
      expect.stringContaining('useTsProjectReferences')
    );
  });

  it('should ignore TS project references and warn with @angular/build >= 22.2', async () => {
    const { compilerOptions, setupWarnings } = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      { ...options, sourceMap: true, useTsProjectReferences: true }
    );

    expect(compilerOptions.inlineSourceMap).toBe(true);
    expect(compilerOptions.inlineSources).toBe(true);
    expect(compilerOptions.sourceMap).toBeUndefined();
    expect(compilerOptions.isolatedModules).toBeUndefined();
    expect(setupWarnings).toContainEqual(
      expect.stringContaining(
        "The 'useTsProjectReferences' option has no effect with Angular 22.2 and later."
      )
    );
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

  it('should keep comments over the tsconfig value', async () => {
    vi.mocked(loadCompilerCli).mockResolvedValueOnce({
      readConfiguration: (
        _tsconfig: string,
        existingOptions: Record<string, unknown>
      ) => ({
        // Like readConfiguration, the passed options win over the tsconfig.
        options: { removeComments: true, module: 99, ...existingOptions },
        rootNames: ['/root/src/main.ts'],
      }),
    } as never);

    const { compilerOptions } = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options
    );

    expect(compilerOptions.removeComments).toBe(false);
  });

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
        options: { ...existingOptions, target: 9, module: 99 },
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

  it('should force partial compilation mode to full and warn', async () => {
    vi.mocked(loadCompilerCli).mockResolvedValueOnce({
      readConfiguration: (
        _tsconfig: string,
        existingOptions: Record<string, unknown>
      ) => ({
        options: {
          ...existingOptions,
          target: 9,
          module: 99,
          compilationMode: 'partial',
        },
        rootNames: ['/root/src/main.ts'],
      }),
    } as never);

    const { compilerOptions, setupWarnings } = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options
    );

    expect(compilerOptions.compilationMode).toBe('full');
    expect(setupWarnings).toEqual([
      expect.stringContaining('partial compilation mode is not supported'),
    ]);
  });

  it('should not change a full compilation mode', async () => {
    vi.mocked(loadCompilerCli).mockResolvedValueOnce({
      readConfiguration: (
        _tsconfig: string,
        existingOptions: Record<string, unknown>
      ) => ({
        options: {
          ...existingOptions,
          target: 9,
          module: 99,
          compilationMode: 'full',
        },
        rootNames: ['/root/src/main.ts'],
      }),
    } as never);

    const { compilerOptions, setupWarnings } = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options
    );

    expect(compilerOptions.compilationMode).toBe('full');
    expect(setupWarnings).toEqual([]);
  });

  it.each([
    [undefined, 7, true],
    [1 /* CommonJS */, 7, true],
    [4 /* System */, 7, true],
    [5 /* ES2015 */, 5, false],
    [99 /* ESNext */, 99, false],
    [200 /* Preserve */, 200, false],
  ])(
    'should force unsupported module values to ES2022 (module: %s)',
    async (module, expectedModule, warned) => {
      vi.mocked(loadCompilerCli).mockResolvedValueOnce({
        readConfiguration: (
          _tsconfig: string,
          existingOptions: Record<string, unknown>
        ) => ({
          options: { ...existingOptions, target: 9, module },
          rootNames: ['/root/src/main.ts'],
        }),
      } as never);

      const { compilerOptions, setupWarnings } = await setupCompilation(
        { source: { tsconfigPath: '/root/tsconfig.json' } },
        options
      );

      expect(compilerOptions.module).toBe(expectedModule);
      if (warned) {
        expect(setupWarnings).toContainEqual(
          expect.stringContaining(
            "'module' values 'CommonJS', 'UMD', 'System' and 'AMD' are not supported"
          )
        );
      } else {
        expect(setupWarnings).toEqual([]);
      }
    }
  );

  it.each([
    { moduleResolution: 100 /* Bundler */ },
    { module: 200 /* Preserve */ },
  ])(
    'should sync the custom conditions to the bundler with %o',
    async (caseOpts) => {
      vi.mocked(loadCompilerCli).mockResolvedValueOnce({
        readConfiguration: (
          _tsconfig: string,
          existingOptions: Record<string, unknown>
        ) => ({
          options: {
            ...existingOptions,
            target: 9,
            module: 99,
            customConditions: ['from-tsconfig'],
            ...caseOpts,
          },
          rootNames: ['/root/src/main.ts'],
        }),
      } as never);

      const { compilerOptions } = await setupCompilation(
        { source: { tsconfigPath: '/root/tsconfig.json' } },
        { ...options, customConditions: ['es2020', 'es2015'] }
      );

      expect(compilerOptions.customConditions).toEqual(['es2020', 'es2015']);
    }
  );

  it('should keep the tsconfig custom conditions without bundler-style resolution', async () => {
    vi.mocked(loadCompilerCli).mockResolvedValueOnce({
      readConfiguration: (
        _tsconfig: string,
        existingOptions: Record<string, unknown>
      ) => ({
        options: {
          ...existingOptions,
          target: 9,
          module: 100 /* Node16 */,
          moduleResolution: 3 /* Node16 */,
          customConditions: ['from-tsconfig'],
        },
        rootNames: ['/root/src/main.ts'],
      }),
    } as never);

    const { compilerOptions } = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      { ...options, customConditions: ['es2020'] }
    );

    expect(compilerOptions.customConditions).toEqual(['from-tsconfig']);
  });

  it('should force the preserveSymlinks option over the tsconfig value', async () => {
    const enabled = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      { ...options, preserveSymlinks: true }
    );
    expect(enabled.compilerOptions.preserveSymlinks).toBe(true);

    const disabled = await setupCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options
    );
    expect(disabled.compilerOptions.preserveSymlinks).toBeUndefined();
  });
});
