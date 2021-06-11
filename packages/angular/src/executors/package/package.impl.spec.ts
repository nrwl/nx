jest.mock('@angular/compiler-cli');
jest.mock('@nrwl/workspace/src/core/project-graph');
jest.mock('@nrwl/workspace/src/utilities/buildable-libs-utils');
jest.mock('ng-packagr');

import * as ng from '@angular/compiler-cli';
import type { ExecutorContext } from '@nrwl/devkit';
import * as buildableLibsUtils from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import * as ngPackagr from 'ng-packagr';
import { BehaviorSubject } from 'rxjs';
import packageExecutor from './package.impl';
import type { BuildAngularLibraryExecutorOptions } from './schema';

describe('Package executor', () => {
  let context: ExecutorContext;
  let ngPackagrBuildMock: jest.Mock;
  let ngPackagerWatchSubject: BehaviorSubject<void>;
  let ngPackagrWatchMock: jest.Mock;
  let ngPackagrWithTsConfigMock: jest.Mock;
  let options: BuildAngularLibraryExecutorOptions;
  let tsConfig: { options: { paths: { [key: string]: string[] } } };

  beforeEach(async () => {
    tsConfig = {
      options: {
        paths: { '@myorg/my-package': ['/root/my-package/src/index.ts'] },
      },
    };
    (ng.readConfiguration as jest.Mock).mockImplementation(() => tsConfig);
    (buildableLibsUtils.calculateProjectDependencies as jest.Mock).mockImplementation(
      () => ({
        target: {},
        dependencies: [],
      })
    );
    ngPackagrBuildMock = jest.fn(() => Promise.resolve());
    ngPackagerWatchSubject = new BehaviorSubject<void>(undefined);
    ngPackagrWatchMock = jest.fn(() => ngPackagerWatchSubject.asObservable());
    ngPackagrWithTsConfigMock = jest.fn();
    (ngPackagr.ngPackagr as jest.Mock).mockImplementation(() => ({
      build: ngPackagrBuildMock,
      forProject: jest.fn(),
      watch: ngPackagrWatchMock,
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
    (buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock).mockReturnValue(
      false
    );

    const result = await packageExecutor(options, context);

    expect(result).toEqual({ success: false });
  });

  it('should build the library when deps have been built', async () => {
    (buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock).mockReturnValue(
      true
    );

    const result = await packageExecutor(options, context);

    expect(ngPackagrBuildMock).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('should process tsConfig for incremental builds when tsConfig options is set', async () => {
    (buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock).mockReturnValue(
      true
    );
    const tsConfigPath = '/root/my-lib/tsconfig.app.json';

    const result = await packageExecutor(
      { ...options, tsConfig: tsConfigPath },
      context
    );

    expect(buildableLibsUtils.updatePaths).toHaveBeenCalledWith(
      expect.any(Array),
      tsConfig.options.paths
    );
    expect(ngPackagrWithTsConfigMock).toHaveBeenCalledWith(tsConfig);
    expect(ngPackagrBuildMock).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  describe('--watch', () => {
    it('should emit results everytime there are changes', async () => {
      (buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock).mockReturnValue(
        true
      );

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
