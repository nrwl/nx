jest.mock('ng-packagr/lib/utils/ng-compiler-cli');
jest.mock('@nrwl/workspace/src/core/project-graph');
jest.mock('@nrwl/workspace/src/utilities/buildable-libs-utils');
jest.mock('ng-packagr');

import type { ExecutorContext } from '@nrwl/devkit';
import * as buildableLibsUtils from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import * as ngPackagr from 'ng-packagr';
import { ngCompilerCli } from 'ng-packagr/lib/utils/ng-compiler-cli';
import { BehaviorSubject } from 'rxjs';
import packageExecutor from './package.impl';
import type { BuildAngularLibraryExecutorOptions } from './schema';

describe('Package executor', () => {
  let context: ExecutorContext;
  let ngPackagrBuildMock: jest.Mock;
  let ngPackagerWatchSubject: BehaviorSubject<void>;
  let ngPackagrWatchMock: jest.Mock;
  let ngPackagrWithBuildTransformMock: jest.Mock;
  let ngPackagrWithTsConfigMock: jest.Mock;
  let options: BuildAngularLibraryExecutorOptions;

  beforeEach(async () => {
    (
      buildableLibsUtils.calculateProjectDependencies as jest.Mock
    ).mockImplementation(() => ({
      target: {},
      dependencies: [],
    }));
    ngPackagrBuildMock = jest.fn(() => Promise.resolve());
    ngPackagerWatchSubject = new BehaviorSubject<void>(undefined);
    ngPackagrWatchMock = jest.fn(() => ngPackagerWatchSubject.asObservable());
    ngPackagrWithBuildTransformMock = jest.fn();
    ngPackagrWithTsConfigMock = jest.fn();
    (ngPackagr.NgPackagr as jest.Mock).mockImplementation(() => ({
      build: ngPackagrBuildMock,
      forProject: jest.fn(),
      watch: ngPackagrWatchMock,
      withBuildTransform: ngPackagrWithBuildTransformMock,
      withTsConfig: ngPackagrWithTsConfigMock,
    }));

    context = {
      root: '/root',
      projectName: 'my-lib',
      targetName: 'build',
      configurationName: 'production',
    } as ExecutorContext;
    options = { project: 'my-lib' };
  });

  afterEach(() => jest.clearAllMocks());

  it('should return unsuccessful result when deps have not been built', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(false);

    const result = await packageExecutor(options, context).next();

    expect(result.value).toEqual({ success: false });
    expect(result.done).toBe(true);
  });

  it('should build the library when deps have been built', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(true);

    const result = await packageExecutor(options, context).next();

    expect(ngPackagrBuildMock).toHaveBeenCalled();
    expect(result.value).toEqual({ success: true });
    expect(result.done).toBe(true);
  });

  it('should not set up incremental builds when tsConfig option is not set', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(true);
    (ngCompilerCli as jest.Mock).mockImplementation(() =>
      Promise.resolve({ readConfiguration: jest.fn() })
    );

    const result = await packageExecutor(options, context).next();

    expect((await ngCompilerCli()).readConfiguration).not.toHaveBeenCalled();
    expect(buildableLibsUtils.updatePaths).not.toHaveBeenCalled();
    expect(ngPackagrWithTsConfigMock).not.toHaveBeenCalled();
    expect(ngPackagrBuildMock).toHaveBeenCalled();
    expect(result.value).toEqual({ success: true });
    expect(result.done).toBe(true);
  });

  it('should process tsConfig for incremental builds when tsConfig option is set and enableIvy is true', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(true);
    const tsConfig = {
      options: {
        paths: { '@myorg/my-package': ['/root/my-package/src/index.ts'] },
        enableIvy: true,
      },
    };
    (ngCompilerCli as jest.Mock).mockImplementation(() =>
      Promise.resolve({ readConfiguration: () => tsConfig })
    );
    const tsConfigPath = '/root/my-lib/tsconfig.app.json';

    const result = await packageExecutor(
      { ...options, tsConfig: tsConfigPath },
      context
    ).next();

    expect(buildableLibsUtils.updatePaths).toHaveBeenCalledWith(
      expect.any(Array),
      tsConfig.options.paths
    );
    expect(ngPackagrWithTsConfigMock).toHaveBeenCalledWith(tsConfig);
    expect(ngPackagrBuildMock).toHaveBeenCalled();
    expect(result.value).toEqual({ success: true });
    expect(result.done).toBe(true);
  });

  describe('--watch', () => {
    it('should emit results everytime there are changes', async () => {
      (
        buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
      ).mockReturnValue(true);

      const results = packageExecutor({ ...options, watch: true }, context);

      ngPackagerWatchSubject.next();
      let changes = 0;
      for await (const result of results) {
        changes++;
        expect(result).toEqual({ success: true });
        if (changes === 2) {
          ngPackagerWatchSubject.complete();
        } else {
          ngPackagerWatchSubject.next();
        }
      }
      expect(ngPackagrWatchMock).toHaveBeenCalledTimes(1);
    });
  });
});
