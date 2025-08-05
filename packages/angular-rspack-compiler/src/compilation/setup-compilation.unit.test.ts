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
import * as ngCli from '@angular/compiler-cli';
import * as loadCompilerCli from '../utils/load-compiler-cli';

vi.mock('@angular/compiler-cli');

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
    inlineStyleLanguage: 'css',
    useTsProjectReferences: false,
    fileReplacements: [],
  };

  let readConfigurationSpy: MockInstance<
    [string],
    ngCli.AngularCompilerOptions
  >;

  beforeAll(async () => {
    readConfigurationSpy = vi
      .spyOn(await loadCompilerCli.loadCompilerCli(), 'readConfiguration')
      .mockReturnValue({
        options: pluginAngularOptions,
        rootNames: ['main.ts'],
      });
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
        inlineStyleLanguage: 'css',
        aot: true,
        tsConfig: expect.stringMatching(/tsconfig.angular.json$/),
        useTsProjectReferences: false,
        fileReplacements: [],
      },
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
