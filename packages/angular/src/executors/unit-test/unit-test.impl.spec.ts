import * as angularVersionUtils from '../utilities/angular-version-utils';

// The executor pulls in the Angular CLI adapter and esbuild plugin loaders at
// module scope; option validation runs before any of them, so stub them out to
// keep the spec a pure unit test of the version gates.
jest.mock('nx/src/adapter/ngcli-adapter', () => ({
  createBuilderContext: jest.fn().mockResolvedValue({
    getBuilderNameForTarget: jest.fn(),
    getTargetOptions: jest.fn(),
  }),
}));
jest.mock('../utilities/esbuild-extensions', () => ({
  loadPlugins: jest.fn().mockResolvedValue([]),
  loadIndexHtmlTransformer: jest.fn(),
}));
jest.mock('../utilities/builder-package', () => ({
  assertPackageIsInstalled: jest.fn(),
}));
jest.mock('@angular/build', () => ({
  executeUnitTestBuilder: jest.fn(async function* () {
    yield { success: true };
  }),
}));

import unitTestExecutor from './unit-test.impl';
import type { UnitTestExecutorOptions } from './schema';

describe('unitTestExecutor option validation', () => {
  let getInstalledAngularVersionInfoSpy: jest.SpyInstance;

  // validateOptions runs synchronously at the top of the generator body, so the
  // first `.next()` surfaces any gate error as a rejected promise.
  const run = (options: Partial<UnitTestExecutorOptions>) =>
    unitTestExecutor(
      options as UnitTestExecutorOptions,
      {
        projectName: 'app',
      } as any
    ).next();

  beforeEach(() => {
    getInstalledAngularVersionInfoSpy = jest.spyOn(
      angularVersionUtils,
      'getInstalledAngularVersionInfo'
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws when the Angular version is < 21', async () => {
    getInstalledAngularVersionInfoSpy.mockReturnValue({
      major: 20,
      version: '20.1.0',
    });

    await expect(run({})).rejects.toThrow(
      'The "unit-test" executor is only available for Angular versions >= 21.0.0. You are currently using version 20.1.0.'
    );
  });

  it('throws when "headless" is set on Angular < 21.2.0', async () => {
    getInstalledAngularVersionInfoSpy.mockReturnValue({
      major: 21,
      version: '21.1.0',
    });

    await expect(run({ headless: true })).rejects.toThrow(
      'The "headless" option requires Angular version 21.2.0 or greater. You are currently using version 21.1.0.'
    );
  });

  it('throws when "isolate" is set on Angular < 22', async () => {
    getInstalledAngularVersionInfoSpy.mockReturnValue({
      major: 21,
      version: '21.2.0',
    });

    await expect(run({ isolate: true })).rejects.toThrow(
      'The "isolate" option requires Angular version 22.0.0 or greater. You are currently using version 21.2.0.'
    );
  });

  it('throws when "quiet" is set on Angular < 22', async () => {
    getInstalledAngularVersionInfoSpy.mockReturnValue({
      major: 21,
      version: '21.2.0',
    });

    await expect(run({ quiet: true })).rejects.toThrow(
      'The "quiet" option requires Angular version 22.0.0 or greater. You are currently using version 21.2.0.'
    );
  });

  it('allows "isolate" and "quiet" on Angular >= 22', async () => {
    getInstalledAngularVersionInfoSpy.mockReturnValue({
      major: 22,
      version: '22.0.0',
    });

    const { value } = await run({ isolate: true, quiet: true });

    expect(value).toEqual({ success: true });
  });
});
