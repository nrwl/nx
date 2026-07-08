import { describe, expect, it, vi } from 'vitest';
import type { AngularCompilation, SourceFileCache } from '../models';
import { setupCompilationWithAngularCompilation } from './setup-with-angular-compilation';
import {
  setupCompilation,
  styleTransform,
  type SetupCompilationOptions,
} from './setup-compilation';

vi.mock('./setup-compilation', () => ({
  setupCompilation: vi.fn().mockResolvedValue({
    rootNames: ['/root/src/main.ts'],
    compilerOptions: {},
    componentStylesheetBundler: {},
  }),
  styleTransform: vi.fn(() => async () => ({ contents: '' })),
}));

describe('setupCompilationWithAngularCompilation', () => {
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

  // The default tsconfig (isolated modules, legacy decorators, ES2022) with
  // sourcemaps off takes the fast path; anything the swc rule can't
  // replicate falls back to TypeScript transpilation.
  const fastPathOptions = {
    isolatedModules: true,
    experimentalDecorators: true,
    target: 9,
  };
  it.each([
    [fastPathOptions, false],
    [{}, true],
    [{ ...fastPathOptions, sourceMap: true }, true],
    [{ ...fastPathOptions, inlineSourceMap: true }, true],
    [{ ...fastPathOptions, experimentalDecorators: false }, true],
    [{ ...fastPathOptions, emitDecoratorMetadata: true }, true],
    [{ ...fastPathOptions, useDefineForClassFields: false }, true],
    [{ ...fastPathOptions, verbatimModuleSyntax: true }, true],
    [{ ...fastPathOptions, importsNotUsedAsValues: 1 }, true],
    [{ ...fastPathOptions, target: undefined }, true],
    [{ ...fastPathOptions, target: 4 }, true],
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
