import { describe, expect } from 'vitest';
import * as setupModule from './setup-compilation.ts';
import * as ts from 'typescript';
import { type SourceFile } from 'typescript';
import { setupCompilationWithAngularCompilation } from './setup-with-angular-compilation.ts';
import { type RsbuildConfig } from '@rsbuild/core';
import * as aotCompilation from '@angular/build/src/tools/angular/compilation/aot-compilation';
import * as jitCompilation from '@angular/build/src/tools/angular/compilation/jit-compilation';
import { type AngularHostOptions } from '@angular/build/src/tools/angular/angular-host';
import { type CompilerOptions } from '@angular/compiler-cli';
import { SetupCompilationOptions } from './setup-compilation.ts';

vi.mock('@angular/build/src/tools/angular/compilation/aot-compilation');

describe('setupCompilationWithAngularCompilation', () => {
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
    .fn((..._: unknown[]) => Promise.resolve({ referencedFiles: [] }))
    .mockResolvedValue({ referencedFiles: [] }) as unknown as I;
  const angularCompilationSpy = vi
    .spyOn(aotCompilation, 'AotCompilation')
    .mockImplementation(
      vi
        .fn()
        .mockImplementation(function (this: aotCompilation.AotCompilation) {
          this.initialize = initializeSpy;
          return this;
        })
    );
  const jitCompilationSpy = vi
    .spyOn(jitCompilation, 'JitCompilation')
    .mockImplementation(
      vi
        .fn()
        .mockImplementation(function (this: jitCompilation.JitCompilation) {
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

  it('should return the angular compilation class', async () => {
    await expect(
      setupCompilationWithAngularCompilation(
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
      setupCompilationWithAngularCompilation(
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

  it('should instantiate AngularCompilation based on jit option', async () => {
    await expect(() =>
      setupCompilationWithAngularCompilation(rsBuildConfig, {
        ...pluginAngularOptions,
        aot: false,
        hasServer: false,
      })
    ).not.toThrow();

    expect(jitCompilationSpy).toHaveBeenCalledTimes(1);
    expect(jitCompilationSpy).toHaveBeenCalledWith(true);
  });

  it('should instantiate AotCompilation based on server option', async () => {
    await expect(() =>
      setupCompilationWithAngularCompilation(rsBuildConfig, {
        ...pluginAngularOptions,
        aot: false,
        hasServer: true,
      })
    ).not.toThrow();

    expect(jitCompilationSpy).toHaveBeenCalledTimes(1);
    expect(jitCompilationSpy).toHaveBeenCalledWith(false);
  });

  it('should initialize aot compilation', async () => {
    const paralell = await setupCompilationWithAngularCompilation(
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
    'should handle initialize errors of the aot compilation',
    async () => {
      const initializeSpy = vi
        .fn()
        .mockRejectedValue(new Error('Failed to init'));
      angularCompilationSpy.mockImplementation(
        vi
          .fn()
          .mockImplementation(function (this: aotCompilation.AotCompilation) {
            throw (this.initialize = initializeSpy);
          })
      );

      await expect(
        setupCompilationWithAngularCompilation(
          rsBuildConfig,
          pluginAngularOptions
        )
      ).rejects.toThrow('Failed to initialize Angular Compilation');
    }
  );
});
