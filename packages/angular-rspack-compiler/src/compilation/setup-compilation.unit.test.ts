import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  MockInstance,
  vi,
} from 'vitest';
import {
  DEFAULT_NG_COMPILER_OPTIONS,
  setupCompilation,
  SetupCompilationOptions,
} from './setup-compilation';
import { RsbuildConfig } from '@rsbuild/core';
import * as ts from 'typescript';
import * as ngCli from '@angular/compiler-cli';
import * as loadCompilerCli from '../utils/load-compiler-cli';
import * as augmentModule from './augments';

vi.mock('@angular/compiler-cli');

vi.mock('typescript');

vi.mock('../utils/load-compiler-cli', () => ({
  loadCompilerCli: vi.fn().mockReturnValue({
    readConfiguration: vi.fn(),
  }),
}));

describe('setupCompilation', () => {
  const rsBuildConfig: RsbuildConfig = {
    mode: 'none',
    source: {
      tsconfigPath: 'tsconfig.rsbuild.json',
    },
  };

  const pluginAngularOptions: SetupCompilationOptions = {
    tsConfig: 'tsconfig.angular.json',
    aot: true,
    inlineStylesExtension: 'css',
    useTsProjectReferences: false,
    fileReplacements: [],
  };

  const mockHost = { mocked: 'host' } as unknown as ts.CompilerHost;

  let readConfigurationSpy: MockInstance<
    [string],
    ngCli.AngularCompilerOptions
  >;

  let createIncrementalCompilerHostSpy: MockInstance<
    [options: ts.CompilerOptions, system?: ts.System],
    ts.CompilerHost
  >;
  let augmentHostWithResourcesSpy: MockInstance<
    [
      ts.CompilerHost,
      transform: (
        code: string,
        id: string,
        options?: { ssr?: boolean }
      ) => unknown,
      options?: {
        inlineStylesExtension?: 'css' | 'scss' | 'sass';
        isProd?: boolean;
      }
    ],
    void
  >;

  beforeAll(async () => {
    readConfigurationSpy = vi
      .spyOn(await loadCompilerCli.loadCompilerCli(), 'readConfiguration')
      .mockReturnValue({
        options: pluginAngularOptions,
        rootNames: ['main.ts'],
      });
    createIncrementalCompilerHostSpy = vi
      .spyOn(ts, 'createIncrementalCompilerHost')
      .mockReturnValue(mockHost);

    augmentHostWithResourcesSpy = vi
      .spyOn(augmentModule, 'augmentHostWithResources')
      .mockImplementation(vi.fn());
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should return correct compilation configuration', async () => {
    await expect(
      setupCompilation(rsBuildConfig, pluginAngularOptions)
    ).resolves.toStrictEqual({
      compilerOptions: {
        inlineStylesExtension: 'css',
        aot: true,
        tsConfig: expect.stringMatching(/tsconfig.angular.json$/),
        useTsProjectReferences: false,
        fileReplacements: [],
      },
      host: expect.any(Object),
      rootNames: ['main.ts'],
      componentStylesheetBundler: expect.any(Object),
    });
  });

  it('should read configuration from rs build configuration if given', async () => {
    await expect(
      setupCompilation(rsBuildConfig, pluginAngularOptions)
    ).resolves.not.toThrow();
    expect(readConfigurationSpy).toHaveBeenCalledTimes(1);
    expect(readConfigurationSpy).toHaveBeenCalledWith(
      expect.stringMatching(/tsconfig.rsbuild.json$/),
      DEFAULT_NG_COMPILER_OPTIONS
    );
  });

  it('should read configuration from plugin angular options if rs build configuration is not given', async () => {
    await expect(
      setupCompilation(
        {
          ...rsBuildConfig,
          source: undefined,
        },
        pluginAngularOptions
      )
    ).resolves.not.toThrow();

    expect(readConfigurationSpy).toHaveBeenCalledTimes(1);
    expect(readConfigurationSpy).toHaveBeenCalledWith(
      expect.stringMatching(/tsconfig.angular.json$/),
      DEFAULT_NG_COMPILER_OPTIONS
    );
  });

  it('should use the parsed compiler options to create an incremental compiler host', async () => {
    await expect(
      setupCompilation(rsBuildConfig, pluginAngularOptions)
    ).resolves.not.toThrow();
    expect(createIncrementalCompilerHostSpy).toHaveBeenCalledTimes(1);
    expect(createIncrementalCompilerHostSpy).toHaveBeenCalledWith({
      inlineStylesExtension: 'css',
      aot: true,
      tsConfig: expect.stringMatching(/tsconfig.angular.json$/),
      useTsProjectReferences: false,
      fileReplacements: [],
    });
  });

  it('should augment the host with resources if not in JIT mode', async () => {
    await expect(
      setupCompilation(rsBuildConfig, pluginAngularOptions)
    ).resolves.not.toThrow();
    expect(augmentHostWithResourcesSpy).toHaveBeenCalledTimes(1);
  });

  it('should augment the host with resources if in JIT mode', () => {
    expect(
      async () =>
        await setupCompilation(rsBuildConfig, {
          ...pluginAngularOptions,
          aot: false,
        })
    ).not.toThrow();
    expect(augmentHostWithResourcesSpy).not.toHaveBeenCalled();
  });

  it('should not filter rootNames if useAllRoots is true', async () => {
    const rootNames = ['src/main.ts', 'src/server.ts'];
    readConfigurationSpy.mockReturnValue({
      options: {},
      rootNames,
    });

    expect(
      (await setupCompilation(rsBuildConfig, pluginAngularOptions)).rootNames
    ).toBe(rootNames);
  });
});
