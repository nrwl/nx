jest.mock('ng-packagr/lib/utils/ng-compiler-cli');
jest.mock('@nrwl/workspace/src/core/project-graph');
jest.mock('@nrwl/workspace/src/utilities/buildable-libs-utils');
jest.mock('ng-packagr');

import type { ExecutorContext } from '@nrwl/devkit';
import * as buildableLibsUtils from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import * as ngPackagr from 'ng-packagr';
import { BehaviorSubject } from 'rxjs';
import type { BuildAngularLibraryExecutorOptions } from '../package/schema';
import { NX_ENTRY_POINT_PROVIDERS } from './ng-packagr-adjustments/entry-point.di';
import {
  NX_PACKAGE_PROVIDERS,
  NX_PACKAGE_TRANSFORM,
} from './ng-packagr-adjustments/package.di';
import { ngCompilerCli } from 'ng-packagr/lib/utils/ng-compiler-cli';
import ngPackagrLiteExecutor from './ng-packagr-lite.impl';

describe('NgPackagrLite executor', () => {
  let context: ExecutorContext;
  let ngPackagrBuildMock: jest.Mock;
  let ngPackagerWatchSubject: BehaviorSubject<void>;
  let ngPackagrWatchMock: jest.Mock;
  let ngPackagrWithBuildTransformMock: jest.Mock;
  let ngPackagrWithTsConfigMock: jest.Mock;
  let options: BuildAngularLibraryExecutorOptions;
  let tsConfig: { options: { paths: { [key: string]: string[] } } };

  beforeEach(async () => {
    tsConfig = {
      options: {
        paths: { '@myorg/my-package': ['/root/my-package/src/index.ts'] },
      },
    };
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

    const result = await ngPackagrLiteExecutor(options, context).next();

    expect(result.value).toEqual({ success: false });
    expect(result.done).toBe(true);
  });

  it('should build the library when deps have been built', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(true);

    const result = await ngPackagrLiteExecutor(options, context).next();

    expect(ngPackagrBuildMock).toHaveBeenCalled();
    expect(result.value).toEqual({ success: true });
    expect(result.done).toBe(true);
  });

  it('should instantiate NgPackager with the right providers and set to use the right build transformation provider', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(true);

    const result = await ngPackagrLiteExecutor(options, context).next();

    expect(ngPackagr.NgPackagr).toHaveBeenCalledWith([
      ...NX_PACKAGE_PROVIDERS,
      ...NX_ENTRY_POINT_PROVIDERS,
    ]);
    expect(ngPackagrWithBuildTransformMock).toHaveBeenCalledWith(
      NX_PACKAGE_TRANSFORM.provide
    );
    expect(result.value).toEqual({ success: true });
    expect(result.done).toBe(true);
  });

  it('should process tsConfig for incremental builds when tsConfig options is set', async () => {
    // ARRANGE
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(true);

    (ngCompilerCli as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        readConfiguration: (...args) => tsConfig,
      })
    );
    const tsConfigPath = '/root/my-lib/tsconfig.app.json';

    // ACT
    const result = await ngPackagrLiteExecutor(
      { ...options, tsConfig: tsConfigPath },
      context
    ).next();

    // ASSERT
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

      const results = ngPackagrLiteExecutor(
        { ...options, watch: true },
        context
      );

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
