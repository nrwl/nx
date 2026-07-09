import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  toTypeScriptFileCacheKey,
  type AngularCompilation,
  type SourceFileCache,
} from '../models';
import { setupCompilationWithAngularCompilation } from './setup-with-angular-compilation';
import {
  setupCompilation,
  styleTransform,
  type SetupCompilationOptions,
} from './setup-compilation';

const { createAngularCompilationMock } = vi.hoisted(() => ({
  createAngularCompilationMock: vi.fn(),
}));

vi.mock('./setup-compilation', () => ({
  setupCompilation: vi.fn().mockResolvedValue({
    rootNames: ['/root/src/main.ts'],
    compilerOptions: {},
    componentStylesheetBundler: {},
  }),
  styleTransform: vi.fn(() => async () => ({ contents: '' })),
}));

vi.mock('../models', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../models')>()),
  createAngularCompilation: createAngularCompilationMock,
}));

describe('setupCompilationWithAngularCompilation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const options: SetupCompilationOptions = {
    root: '/root',
    tsConfig: '/root/tsconfig.json',
    aot: true,
    inlineStyleLanguage: 'css',
    fileReplacements: [],
  };

  it('should propagate initialization errors', async () => {
    const angularCompilation = {
      initialize: vi
        .fn()
        .mockRejectedValue(new Error('TS version not supported')),
    } as unknown as AngularCompilation;

    await expect(
      setupCompilationWithAngularCompilation(
        { source: { tsconfigPath: '/root/tsconfig.json' } },
        options,
        undefined,
        angularCompilation
      )
    ).rejects.toThrow('TS version not supported');
  });

  it('should set referenced files on the source file cache', async () => {
    const angularCompilation = {
      initialize: vi
        .fn()
        .mockResolvedValue({ referencedFiles: ['/root/src/main.ts'] }),
    } as unknown as AngularCompilation;
    const sourceFileCache = {} as SourceFileCache;

    const result = await setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options,
      sourceFileCache,
      angularCompilation
    );

    expect(sourceFileCache.referencedFiles).toEqual(['/root/src/main.ts']);
    expect(result.angularCompilation).toBe(angularCompilation);
  });

  it('should re-key the compiler-tracked resource dependencies like the emit cache', async () => {
    const angularCompilation = {
      initialize: vi.fn().mockResolvedValue({
        referencedFiles: [],
        componentResourcesDependencies: new Map([
          [
            'C:/root/src/app/app.component.ts',
            ['/root/src/app/app.component.html'],
          ],
        ]),
      }),
    } as unknown as AngularCompilation;

    const result = await setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options,
      undefined,
      angularCompilation
    );

    expect(result.resourceDependencies).toEqual(
      new Map([
        [
          toTypeScriptFileCacheKey('C:/root/src/app/app.component.ts'),
          ['/root/src/app/app.component.html'],
        ],
      ])
    );
  });

  it('should create a worker-based Angular compilation by default', async () => {
    const angularCompilation = {
      initialize: vi.fn().mockResolvedValue({ referencedFiles: [] }),
    };
    createAngularCompilationMock.mockResolvedValueOnce(angularCompilation);

    const result = await setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options
    );

    expect(createAngularCompilationMock).toHaveBeenCalledWith(
      false,
      true,
      true
    );
    expect(result.angularCompilation).toBe(angularCompilation);
  });

  it.each(['0', 'false', 'FALSE'])(
    'should use the in-process Angular compilation when NG_BUILD_PARALLEL_TS is "%s"',
    async (value) => {
      vi.stubEnv('NG_BUILD_PARALLEL_TS', value);
      createAngularCompilationMock.mockResolvedValueOnce({
        initialize: vi.fn().mockResolvedValue({ referencedFiles: [] }),
      });

      await setupCompilationWithAngularCompilation(
        { source: { tsconfigPath: '/root/tsconfig.json' } },
        options
      );

      expect(createAngularCompilationMock).toHaveBeenCalledWith(
        false,
        true,
        false
      );
    }
  );

  it('should compute the transpilation gate from the options the compilation reports, not the local ones', async () => {
    vi.mocked(setupCompilation).mockResolvedValueOnce({
      rootNames: ['/root/src/main.ts'],
      // Gate-relevant local values that differ from what the compilation
      // reports; they must not leak into the gate.
      compilerOptions: {
        isolatedModules: false,
        sourceMap: true,
      },
      componentStylesheetBundler: {},
    } as never);
    const angularCompilation = {
      initialize: vi.fn().mockResolvedValue({
        referencedFiles: [],
        // The worker-based compilation only marshals these options back.
        compilerOptions: {
          allowJs: false,
          isolatedModules: true,
          sourceMap: undefined,
          inlineSourceMap: undefined,
        },
      }),
    } as unknown as AngularCompilation;

    const result = await setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options,
      undefined,
      angularCompilation
    );

    expect(result.useTypeScriptTranspilation).toBe(false);
  });

  it('should not build resource dependencies when the compilation does not report them', async () => {
    const angularCompilation = {
      initialize: vi.fn().mockResolvedValue({ referencedFiles: [] }),
    } as unknown as AngularCompilation;

    const result = await setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options,
      undefined,
      angularCompilation
    );

    expect(result.resourceDependencies).toBeUndefined();
  });

  it('should invalidate the stylesheet bundler for modified files', async () => {
    const invalidate = vi.fn();
    vi.mocked(setupCompilation).mockResolvedValueOnce({
      rootNames: ['/root/src/main.ts'],
      compilerOptions: {},
      componentStylesheetBundler: { invalidate },
    } as unknown as Awaited<ReturnType<typeof setupCompilation>>);
    const angularCompilation = {
      initialize: vi.fn().mockResolvedValue({ referencedFiles: [] }),
    } as unknown as AngularCompilation;
    const modifiedFiles = new Set(['/root/src/app/app.component.css']);

    await setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options,
      undefined,
      angularCompilation,
      modifiedFiles
    );

    expect(invalidate).toHaveBeenCalledWith(modifiedFiles);
  });

  it('should not invalidate the stylesheet bundler on the initial build', async () => {
    const invalidate = vi.fn();
    vi.mocked(setupCompilation).mockResolvedValueOnce({
      rootNames: ['/root/src/main.ts'],
      compilerOptions: {},
      componentStylesheetBundler: { invalidate },
    } as unknown as Awaited<ReturnType<typeof setupCompilation>>);
    const angularCompilation = {
      initialize: vi.fn().mockResolvedValue({ referencedFiles: [] }),
    } as unknown as AngularCompilation;

    await setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options,
      undefined,
      angularCompilation
    );

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('should persist the TS incremental state when a persistent cache path is available', async () => {
    const compilerOptions: Record<string, unknown> = {};
    vi.mocked(setupCompilation).mockResolvedValueOnce({
      rootNames: ['/root/src/main.ts'],
      compilerOptions,
      componentStylesheetBundler: {},
    } as unknown as Awaited<ReturnType<typeof setupCompilation>>);
    const angularCompilation = {
      initialize: vi.fn().mockResolvedValue({ referencedFiles: [] }),
    } as unknown as AngularCompilation;
    const sourceFileCache = {
      persistentCachePath: '/root/.angular/cache/22.0.0/app',
    } as SourceFileCache;

    await setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options,
      sourceFileCache,
      angularCompilation
    );

    expect(compilerOptions.incremental).toBe(true);
    expect(compilerOptions.tsBuildInfoFile).toBe(
      join('/root/.angular/cache/22.0.0/app', '.tsbuildinfo')
    );
  });

  it('should respect an explicitly disabled incremental compilation', async () => {
    const compilerOptions: Record<string, unknown> = { incremental: false };
    vi.mocked(setupCompilation).mockResolvedValueOnce({
      rootNames: ['/root/src/main.ts'],
      compilerOptions,
      componentStylesheetBundler: {},
    } as unknown as Awaited<ReturnType<typeof setupCompilation>>);
    const angularCompilation = {
      initialize: vi.fn().mockResolvedValue({ referencedFiles: [] }),
    } as unknown as AngularCompilation;
    const sourceFileCache = {
      persistentCachePath: '/root/.angular/cache/22.0.0/app',
    } as SourceFileCache;

    await setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options,
      sourceFileCache,
      angularCompilation
    );

    expect(compilerOptions.incremental).toBe(false);
    expect(compilerOptions.tsBuildInfoFile).toBeUndefined();
  });

  it('should disable incremental compilation without a persistent cache path', async () => {
    const compilerOptions: Record<string, unknown> = {};
    vi.mocked(setupCompilation).mockResolvedValueOnce({
      rootNames: ['/root/src/main.ts'],
      compilerOptions,
      componentStylesheetBundler: {},
    } as unknown as Awaited<ReturnType<typeof setupCompilation>>);
    const angularCompilation = {
      initialize: vi.fn().mockResolvedValue({ referencedFiles: [] }),
    } as unknown as AngularCompilation;

    await setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options,
      undefined,
      angularCompilation
    );

    expect(compilerOptions.incremental).toBe(false);
    expect(compilerOptions.tsBuildInfoFile).toBeUndefined();
  });

  // The flag must mirror the emit's own gate (isolated modules and no
  // sourcemaps emit raw Angular-transformed TypeScript); tsconfig semantics
  // like decorators or class fields are the swc rule's concern and must not
  // flip the classification of what the compilation emitted.
  const fastPathOptions = {
    isolatedModules: true,
    experimentalDecorators: true,
    target: 9,
  };
  it.each([
    [fastPathOptions, false],
    [{}, true],
    [{ isolatedModules: false }, true],
    [{ ...fastPathOptions, sourceMap: true }, true],
    [{ ...fastPathOptions, inlineSourceMap: true }, true],
    [{ ...fastPathOptions, experimentalDecorators: false }, false],
    [{ ...fastPathOptions, emitDecoratorMetadata: true }, false],
    [{ ...fastPathOptions, useDefineForClassFields: false }, false],
    [{ ...fastPathOptions, verbatimModuleSyntax: true }, false],
    // Module federation apps set target ES2020; the emit still produces raw
    // TypeScript, so the loaders must not hand it to the JS transformer.
    [{ ...fastPathOptions, target: 7 }, false],
    [{ ...fastPathOptions, target: undefined }, false],
  ])(
    'should compute useTypeScriptTranspilation from the initialized compiler options %o',
    async (initializedCompilerOptions, expected) => {
      const angularCompilation = {
        initialize: vi.fn().mockResolvedValue({
          referencedFiles: [],
          compilerOptions: initializedCompilerOptions,
        }),
      } as unknown as AngularCompilation;

      const result = await setupCompilationWithAngularCompilation(
        { source: { tsconfigPath: '/root/tsconfig.json' } },
        options,
        undefined,
        angularCompilation
      );

      expect(result.useTypeScriptTranspilation).toBe(expected);
    }
  );

  it('should collect stylesheet metafile inputs keyed by stylesheet', async () => {
    vi.mocked(styleTransform).mockReturnValueOnce(async () => ({
      contents: '.a{}',
      metafile: {
        outputs: {
          'out.css': {
            inputs: {
              'node_modules/css-pkg/styles.css': { bytesInOutput: 3 },
            },
          },
        },
      },
    }));
    let hostOptions:
      | {
          transformStylesheet: (
            styles: string,
            containingFile: string,
            stylesheetFile?: string,
            order?: number,
            className?: string
          ) => Promise<string>;
        }
      | undefined;
    const angularCompilation = {
      initialize: vi.fn().mockImplementation((_tsconfig, host) => {
        hostOptions = host;
        return Promise.resolve({ referencedFiles: [] });
      }),
    } as unknown as AngularCompilation;

    const result = await setupCompilationWithAngularCompilation(
      { source: { tsconfigPath: '/root/tsconfig.json' } },
      options,
      undefined,
      angularCompilation
    );

    await hostOptions!.transformStylesheet(
      '.a{}',
      '/root/src/app/app.component.ts',
      '/root/src/app/app.component.scss'
    );
    await hostOptions!.transformStylesheet(
      '.b{}',
      '/root/src/app/app.component.ts',
      undefined,
      0,
      'AppComponent'
    );

    expect(result.collectedStylesheetMetafileInputs).toEqual([
      {
        source: '/root/src/app/app.component.scss',
        inputs: { 'node_modules/css-pkg/styles.css': { bytesInOutput: 3 } },
      },
      {
        source: '/root/src/app/app.component.ts?class=AppComponent&order=0',
        inputs: { 'node_modules/css-pkg/styles.css': { bytesInOutput: 3 } },
      },
    ]);
  });
});
