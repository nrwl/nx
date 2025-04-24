import { describe, expect } from 'vitest';
import * as setupModule from './setup-compilation.ts';
import ts, { type SourceFile } from 'typescript';
import { setupCompilationWithParallelCompilation } from './setup-with-paralell-compilation.ts';
import { type RsbuildConfig } from '@rsbuild/core';
import * as parallelCompilation from '@angular/build/src/tools/angular/compilation/parallel-compilation';
import { type AngularHostOptions } from '@angular/build/src/tools/angular/angular-host';
import { type CompilerOptions } from '@angular/compiler-cli';
import { SetupCompilationOptions } from './setup-compilation.ts';

vi.mock('@angular/build/src/tools/angular/compilation/parallel-compilation');

describe('setupCompilationWithParallelCompilation', () => {
  const rsBuildConfig: RsbuildConfig = {
    mode: 'none',
    source: {
      tsconfigPath: 'tsconfig.rsbuild.json',
    },
  };

  const pluginAngularOptions: SetupCompilationOptions = {
    tsConfig: 'tsconfig.angular.json',
    fileReplacements: [
      {
        replace: 'src/main.ts',
        with: 'src/main.prod.ts',
      },
    ],
    aot: true,
    inlineStyleLanguage: 'css',
    root: '',
  };

  const initializeSpy = vi

    .fn((..._: unknown[]) => Promise.resolve(void 0))
    .mockResolvedValue(void 0) as unknown as I;
  const parallelCompilationSpy = vi
    .spyOn(parallelCompilation, 'ParallelCompilation')
    .mockImplementation(
      vi
        .fn()
        .mockImplementation(function (
          this: parallelCompilation.ParallelCompilation
        ) {
          this.initialize = initializeSpy;
          return this;
        })
    );
  const setupCompilationSpy = vi
    .spyOn(setupModule, 'setupCompilation')
    .mockReturnValue({
      rootNames: ['src/main.ts'],
      host: { mocked: 'host' } as unknown as ts.CompilerHost,
      compilerOptions: {},
    });
  type I = (
    tsconfig: string,
    hostOptions: AngularHostOptions,
    compilerOptionsTransformer?:
      | ((compilerOptions: CompilerOptions) => CompilerOptions)
      | undefined
  ) => Promise<{
    affectedFiles: Set<SourceFile>;
    compilerOptions: ts.CompilerOptions;
    referencedFiles: [];
    externalStylesheets: undefined;
  }>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the parallel compilation class', async () => {
    await expect(
      setupCompilationWithParallelCompilation(
        rsBuildConfig,
        pluginAngularOptions
      )
    ).resolves.toStrictEqual(
      expect.objectContaining({
        initialize: initializeSpy,
      })
    );
  });

  it('should call setupCompilation to retrieve the config', async () => {
    await expect(() =>
      setupCompilationWithParallelCompilation(
        rsBuildConfig,
        pluginAngularOptions
      )
    ).not.toThrow();

    expect(setupCompilationSpy).toHaveBeenCalledTimes(1);
    expect(setupCompilationSpy).toHaveBeenCalledWith(
      rsBuildConfig,
      pluginAngularOptions
    );
  });

  it('should instantiate ParallelCompilation based on jit option', async () => {
    await expect(() =>
      setupCompilationWithParallelCompilation(rsBuildConfig, {
        ...pluginAngularOptions,
        aot: false,
        hasServer: false,
      })
    ).not.toThrow();

    expect(parallelCompilationSpy).toHaveBeenCalledTimes(1);
    expect(parallelCompilationSpy).toHaveBeenCalledWith(true, true);
  });

  it('should instantiate ParallelCompilation based on server option', async () => {
    await expect(() =>
      setupCompilationWithParallelCompilation(rsBuildConfig, {
        ...pluginAngularOptions,
        aot: false,
        hasServer: true,
      })
    ).not.toThrow();

    expect(parallelCompilationSpy).toHaveBeenCalledTimes(1);
    expect(parallelCompilationSpy).toHaveBeenCalledWith(true, false);
  });

  it('should initialize parallel compilation', async () => {
    const paralell = await setupCompilationWithParallelCompilation(
      rsBuildConfig,
      pluginAngularOptions
    );

    expect(paralell.initialize).toHaveBeenCalledTimes(1);
    expect(paralell.initialize).toHaveBeenCalledWith(
      rsBuildConfig.source?.tsconfigPath,
      expect.objectContaining({
        fileReplacements: {
          'src/main.ts': 'src/main.prod.ts',
        },
      }),
      expect.any(Function)
    );
  });

  it.todo(
    'should handle initialize errors of the parallel compilation',
    async () => {
      const initializeSpy = vi
        .fn()
        .mockRejectedValue(new Error('Failed to init'));
      parallelCompilationSpy.mockImplementation(
        vi
          .fn()
          .mockImplementation(function (
            this: parallelCompilation.ParallelCompilation
          ) {
            throw (this.initialize = initializeSpy);
          })
      );

      await expect(
        setupCompilationWithParallelCompilation(
          rsBuildConfig,
          pluginAngularOptions
        )
      ).rejects.toThrow('Failed to initialize Angular Compilation');
    }
  );
});
