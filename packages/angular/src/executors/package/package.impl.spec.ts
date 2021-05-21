import type { ExecutorContext } from '@nrwl/devkit';
import { BehaviorSubject } from 'rxjs';

const ngPackagrBuildMock = jest.fn(() => Promise.resolve());
const ngPackagerWatchSubject = new BehaviorSubject<void>(undefined);
const ngPackagrWatchMock = jest.fn(() => ngPackagerWatchSubject.asObservable());
const ngPackagrWithTsConfigMock = jest.fn(() => {});
jest.doMock('ng-packagr', () => ({
  ngPackagr: jest.fn(() => ({
    build: ngPackagrBuildMock,
    forProject: jest.fn(),
    watch: ngPackagrWatchMock,
    withTsConfig: ngPackagrWithTsConfigMock,
  })),
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
import {
  checkDependentProjectsHaveBeenBuilt,
  updatePaths,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
const checkDependentProjectsHaveBeenBuiltMock = checkDependentProjectsHaveBeenBuilt as jest.Mock<boolean>;

import packageExecutor from './package.impl';
import type { BuildAngularLibraryExecutorOptions } from './schema';

describe('Package executor', () => {
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

    const result = await packageExecutor(options, context);

    expect(result).toEqual({ success: false });
  });

  it('should build the library when deps have been built', async () => {
    checkDependentProjectsHaveBeenBuiltMock.mockReturnValue(true);

    const result = await packageExecutor(options, context);

    expect(ngPackagrBuildMock).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('should process tsConfig for incremental builds when tsConfig options is set', async () => {
    checkDependentProjectsHaveBeenBuiltMock.mockReturnValue(true);
    const tsConfigPath = '/root/my-lib/tsconfig.app.json';

    const result = await packageExecutor(
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

      const results = packageExecutor(
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
