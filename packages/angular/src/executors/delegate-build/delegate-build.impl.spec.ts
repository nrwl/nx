jest.mock('@nrwl/devkit');
jest.mock('@nrwl/devkit');
jest.mock('@nrwl/workspace/src/utilities/buildable-libs-utils');

import type { ExecutorContext, Target } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import * as buildableLibsUtils from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import delegateBuildExecutor from './delegate-build.impl';
import type { DelegateBuildExecutorSchema } from './schema';

describe('DelegateBuild executor', () => {
  let context: ExecutorContext;
  let delegateOptions: Omit<DelegateBuildExecutorSchema, 'buildTarget'>;
  let options: DelegateBuildExecutorSchema;
  let delegateTarget: Target;

  beforeEach(async () => {
    (
      buildableLibsUtils.calculateProjectDependencies as jest.Mock
    ).mockImplementation(() => ({
      target: { data: { root: '/root' } },
      dependencies: [],
    }));
    (buildableLibsUtils.createTmpTsConfig as jest.Mock).mockImplementation(
      () => '/my-app/tsconfig.app.generated.json'
    );
    (devkit.parseTargetString as jest.Mock).mockImplementation(
      jest.requireActual('@nrwl/devkit').parseTargetString
    );

    context = {
      root: '/root',
      projectName: 'my-app',
      targetName: 'build',
      configurationName: 'production',
    } as ExecutorContext;
    delegateOptions = {
      outputPath: '/dist/my-app',
      tsConfig: '/my-app/tsconfig.app.generated.json',
    };
    options = {
      buildTarget: 'my-app:custom-build',
      outputPath: '/dist/my-app',
      tsConfig: '/my-app/tsconfig.app.json',
    };
    delegateTarget = {
      project: 'my-app',
      target: 'custom-build',
    };
  });

  afterEach(() => jest.clearAllMocks());

  it('should return unsuccessful result when deps have not been built', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(false);

    const result = await delegateBuildExecutor(options, context).next();

    expect(result.value).toEqual({ success: false });
    expect(result.done).toBe(true);
    expect(devkit.runExecutor).not.toHaveBeenCalled();
  });

  it('should build the app when deps have been built', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(true);
    (devkit.runExecutor as any).mockImplementation(function* () {
      yield { success: true };
    });

    const resultIterator = delegateBuildExecutor(options, context);

    expect((await resultIterator.next()).value).toEqual({ success: true });
    expect(devkit.runExecutor).toHaveBeenCalledWith(
      delegateTarget,
      delegateOptions,
      context
    );
  });

  it('should return unsuccessful result when build fails', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(true);
    (devkit.runExecutor as any).mockImplementation(function* () {
      yield { success: false };
    });

    const result = await delegateBuildExecutor(options, context).next();

    expect(result.value).toEqual({ success: false });
    expect(devkit.runExecutor).toHaveBeenCalledWith(
      delegateTarget,
      delegateOptions,
      context
    );
  });

  it('should support watch mode builds', async () => {
    (
      buildableLibsUtils.checkDependentProjectsHaveBeenBuilt as jest.Mock
    ).mockReturnValue(true);
    (devkit.runExecutor as any).mockImplementation(function* () {
      yield { success: true };
      yield { success: true };
      yield { success: true };
    });

    const resultIterator = delegateBuildExecutor(options, context);

    for await (const result of resultIterator) {
      expect(result).toEqual({ success: true });
    }
    expect(devkit.runExecutor).toHaveBeenCalledWith(
      delegateTarget,
      delegateOptions,
      context
    );
  });
});
