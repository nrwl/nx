jest.mock('@nrwl/workspace/src/core/project-graph');
jest.mock('@nrwl/workspace/src/utilities/buildable-libs-utils');
jest.mock('ng-packagr');
jest.mock('./ng-packagr-adjustments/ng-package/options.di');

import type { ExecutorContext } from '@nrwl/devkit';
import * as buildableLibsUtils from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import * as ngPackagr from 'ng-packagr';
import { BehaviorSubject } from 'rxjs';
import { NX_ENTRY_POINT_PROVIDERS } from './ng-packagr-adjustments/ng-package/entry-point/entry-point.di';
import { nxProvideOptions } from './ng-packagr-adjustments/ng-package/options.di';
import {
  NX_PACKAGE_PROVIDERS,
  NX_PACKAGE_TRANSFORM,
} from './ng-packagr-adjustments/ng-package/package.di';
import { packageExecutor } from './package.impl';
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
      topLevelDependencies: [],
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
      workspace: { projects: { 'my-lib': { root: '/libs/my-lib' } } },
    } as any;
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

  it('should instantiate NgPackager with the right providers and set to use the right build transformation provider', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(true);
    const extraOptions: Partial<BuildAngularLibraryExecutorOptions> = {
      tailwindConfig: 'path/to/tailwind.config.js',
      watch: false,
    };
    const nxProvideOptionsResult = { ...extraOptions, cacheEnabled: true };
    (nxProvideOptions as jest.Mock).mockImplementation(
      () => nxProvideOptionsResult
    );

    const result = await packageExecutor(
      { ...options, ...extraOptions },
      context
    ).next();

    expect(ngPackagr.NgPackagr).toHaveBeenCalledWith([
      ...NX_PACKAGE_PROVIDERS,
      ...NX_ENTRY_POINT_PROVIDERS,
      nxProvideOptionsResult,
    ]);
    expect(ngPackagrWithBuildTransformMock).toHaveBeenCalledWith(
      NX_PACKAGE_TRANSFORM.provide
    );
    expect(result.value).toEqual({ success: true });
    expect(result.done).toBe(true);
  });

  it('should not set up incremental builds when tsConfig option is not set', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(true);

    const result = await packageExecutor(options, context).next();

    expect(buildableLibsUtils.createTmpTsConfig).not.toHaveBeenCalled();
    expect(ngPackagrWithTsConfigMock).not.toHaveBeenCalled();
    expect(ngPackagrBuildMock).toHaveBeenCalled();
    expect(result.value).toEqual({ success: true });
    expect(result.done).toBe(true);
  });

  it('should process tsConfig for incremental builds when tsConfig option is set', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(true);
    const generatedTsConfig = '/root/tmp/my-lib/tsconfig.app.generated.json';
    (buildableLibsUtils.createTmpTsConfig as jest.Mock).mockImplementation(
      () => generatedTsConfig
    );

    const result = await packageExecutor(
      { ...options, tsConfig: '/root/my-lib/tsconfig.app.json' },
      context
    ).next();

    expect(buildableLibsUtils.createTmpTsConfig).toHaveBeenCalled();
    expect(ngPackagrWithTsConfigMock).toHaveBeenCalledWith(generatedTsConfig);
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
