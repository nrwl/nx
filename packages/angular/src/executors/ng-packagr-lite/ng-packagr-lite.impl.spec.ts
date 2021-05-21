import type { ExecutorContext } from '@nrwl/devkit';
import { BehaviorSubject } from 'rxjs';
import { NX_ENTRY_POINT_PROVIDERS } from './ng-packagr-adjustments/entry-point.di';
import {
  NX_PACKAGE_PROVIDERS,
  NX_PACKAGE_TRANSFORM,
} from './ng-packagr-adjustments/package.di';
import type { BuildAngularLibraryExecutorOptions } from '../package/schema';

const ngPackagrBuildMock = jest.fn(() => Promise.resolve());
const ngPackagerWatchSubject = new BehaviorSubject<void>(undefined);
const ngPackagrWatchMock = jest.fn(() => ngPackagerWatchSubject.asObservable());
const ngPackagrWithBuildTransformMock = jest.fn(() => {});
const ngPackagrWithTsConfigMock = jest.fn(() => {});
const NgPackagerMock = jest.fn(() => ({
  build: ngPackagrBuildMock,
  forProject: jest.fn(),
  watch: ngPackagrWatchMock,
  withBuildTransform: ngPackagrWithBuildTransformMock,
  withTsConfig: ngPackagrWithTsConfigMock,
}));
jest.doMock('ng-packagr', () => ({
  NgPackagr: NgPackagerMock,
}));

const tsConfig = {
  options: {
    paths: { '@myorg/my-package': ['/root/my-package/src/index.ts'] },
  },
};
jest.doMock('@angular/compiler-cli', () => ({
  readConfiguration: jest.fn(() => tsConfig),
}));

jest.doMock('@nrwl/workspace/src/core/project-graph', () => ({
  createProjectGraph: jest.fn(),
}));

jest.doMock('@nrwl/workspace/src/utilities/buildable-libs-utils', () => ({
  calculateProjectDependencies: jest.fn(() => ({
    target: {},
    dependencies: [],
  })),
  checkDependentProjectsHaveBeenBuilt: jest.fn(),
  updateBuildableProjectPackageJsonDependencies: jest.fn(),
  updatePaths: jest.fn(),
}));
import ngPackagrLiteExecutor from './ng-packagr-lite.impl';
import {
  checkDependentProjectsHaveBeenBuilt,
  updatePaths,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
const checkDependentProjectsHaveBeenBuiltMock = checkDependentProjectsHaveBeenBuilt as jest.Mock<boolean>;

describe('NgPackagrLite executor', () => {
  let context: ExecutorContext;
  let options: BuildAngularLibraryExecutorOptions;

  beforeEach(async () => {
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
    checkDependentProjectsHaveBeenBuiltMock.mockReturnValue(false);

    const result = await ngPackagrLiteExecutor(options, context);

    expect(result).toEqual({ success: false });
  });

  it('should build the library when deps have been built', async () => {
    checkDependentProjectsHaveBeenBuiltMock.mockReturnValue(true);

    const result = await ngPackagrLiteExecutor(options, context);

    expect(ngPackagrBuildMock).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('should instantiate NgPackager with the right providers and set to use the right build transformation provider', async () => {
    checkDependentProjectsHaveBeenBuiltMock.mockReturnValue(true);

    const result = await ngPackagrLiteExecutor(options, context);

    expect(NgPackagerMock).toHaveBeenCalledWith([
      ...NX_PACKAGE_PROVIDERS,
      ...NX_ENTRY_POINT_PROVIDERS,
    ]);
    expect(ngPackagrWithBuildTransformMock).toHaveBeenCalledWith(
      NX_PACKAGE_TRANSFORM.provide
    );
    expect(result).toEqual({ success: true });
  });

  it('should process tsConfig for incremental builds when tsConfig options is set', async () => {
    checkDependentProjectsHaveBeenBuiltMock.mockReturnValue(true);
    const tsConfigPath = '/root/my-lib/tsconfig.app.json';

    const result = await ngPackagrLiteExecutor(
      { ...options, tsConfig: tsConfigPath },
      context
    );

    expect(updatePaths).toHaveBeenCalledWith(
      expect.any(Array),
      tsConfig.options.paths
    );
    expect(ngPackagrWithTsConfigMock).toHaveBeenCalledWith(tsConfig);
    expect(ngPackagrBuildMock).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  describe('--watch', () => {
    it('should emit results everytime there are changes', async () => {
      checkDependentProjectsHaveBeenBuiltMock.mockReturnValue(true);

      const results = ngPackagrLiteExecutor(
        { ...options, watch: true },
        context
      ) as AsyncIterableIterator<{ success: boolean }>;

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
