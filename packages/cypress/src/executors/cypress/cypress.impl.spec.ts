import * as path from 'path';
import cypressExecutor, { CypressExecutorOptions } from './cypress.impl';

jest.mock('@nrwl/devkit');
let devkit = require('@nrwl/devkit');

jest.mock('../../utils/cypress-version');
import { installedCypressVersion } from '../../utils/cypress-version';

const Cypress = require('cypress');

describe('Cypress builder', () => {
  let cypressRun: jest.SpyInstance;
  let cypressOpen: jest.SpyInstance;
  const cypressOptions: CypressExecutorOptions = {
    cypressConfig: 'apps/my-app-e2e/cypress.json',
    parallel: false,
    tsConfig: 'apps/my-app-e2e/tsconfig.json',
    devServerTarget: 'my-app:serve',
    exit: true,
    record: false,
    baseUrl: undefined,
    watch: false,
    skipServe: false,
  };
  let mockContext;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as any;
  mockContext = { root: '/root', workspace: { projects: {} } } as any;
  (devkit as any).readTargetOptions = jest.fn().mockReturnValue({
    watch: true,
  });
  let runExecutor: any;

  beforeEach(async () => {
    runExecutor = (devkit as any).runExecutor = jest.fn().mockReturnValue([
      {
        success: true,
        baseUrl: 'http://localhost:4200',
      },
    ]);
    (devkit as any).stripIndents = (s) => s;
    (devkit as any).parseTargetString = (s) => {
      const [project, target, configuration] = s.split(':');
      return {
        project,
        target,
        configuration,
      };
    };
    cypressRun = jest
      .spyOn(Cypress, 'run')
      .mockReturnValue(Promise.resolve({}));
    cypressOpen = jest
      .spyOn(Cypress, 'open')
      .mockReturnValue(Promise.resolve({}));
  });

  afterEach(() => jest.clearAllMocks());

  it('should call `Cypress.run` if headless mode is `true`', async () => {
    const { success } = await cypressExecutor(cypressOptions, mockContext);
    expect(success).toEqual(true);

    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { baseUrl: 'http://localhost:4200' },
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
    expect(cypressOpen).not.toHaveBeenCalled();
  });

  it('should call `Cypress.open` if headless mode is `false`', async () => {
    const { success } = await cypressExecutor(
      { ...cypressOptions, headless: false, watch: true },
      mockContext
    );
    expect(success).toEqual(true);

    expect(cypressOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { baseUrl: 'http://localhost:4200' },
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
    expect(cypressRun).not.toHaveBeenCalled();
  });

  it('should fail early if application build fails', async () => {
    (devkit as any).runExecutor = jest.fn().mockReturnValue([
      {
        success: false,
      },
    ]);
    try {
      await cypressExecutor(cypressOptions, mockContext);
      fail('Should not execute');
    } catch (e) {}
  });

  it('should show warnings if using unsupported browsers v3', async () => {
    mockedInstalledCypressVersion.mockReturnValue(3);
    await cypressExecutor(
      {
        ...cypressOptions,
        browser: 'edge',
      },
      mockContext
    );

    expect(devkit.logger.warn).toHaveBeenCalled();
  });

  it('should show warnings if using unsupported browsers v4', async () => {
    mockedInstalledCypressVersion.mockReturnValue(4);
    await cypressExecutor(
      {
        ...cypressOptions,
        browser: 'canary',
      },
      mockContext
    );

    expect(devkit.logger.warn).toHaveBeenCalled();
  });

  it('should show warnings if using v8 deprecated headless flag', async () => {
    mockedInstalledCypressVersion.mockReturnValue(8);
    await cypressExecutor(
      {
        ...cypressOptions,
        headless: true,
      },
      mockContext
    );

    expect(devkit.logger.warn).toHaveBeenCalled();
  });

  it('should skip warnings if using headless flag used on v7 and lower', async () => {
    mockedInstalledCypressVersion.mockReturnValue(7);
    await cypressExecutor(
      {
        ...cypressOptions,
        headless: true,
      },
      mockContext
    );

    expect(devkit.logger.warn).not.toHaveBeenCalled();
  });

  it('should call `Cypress.run` with provided baseUrl', async () => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        devServerTarget: undefined,
        baseUrl: 'http://my-distant-host.com',
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          baseUrl: 'http://my-distant-host.com',
        },
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
  });

  it('should call `Cypress.run` with provided browser', async () => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        browser: 'chrome',
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        browser: 'chrome',
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
  });

  it('should call `Cypress.run` without baseUrl nor dev server target value', async () => {
    const { success } = await cypressExecutor(
      {
        cypressConfig: 'apps/my-app-e2e/cypress.json',
        tsConfig: 'apps/my-app-e2e/tsconfig.json',
        devServerTarget: undefined,
        headless: true,
        exit: true,
        parallel: false,
        record: false,
        baseUrl: undefined,
        watch: false,
        skipServe: false,
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
  });

  it('should call `Cypress.run` with a string of files to ignore', async () => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        ignoreTestFiles: '/some/path/to/a/file.js',
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        ignoreTestFiles: '/some/path/to/a/file.js',
      })
    );
  });

  it('should call `Cypress.run` with a reporter and reporterOptions', async () => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        reporter: 'junit',
        reporterOptions: 'mochaFile=reports/results-[hash].xml,toConsole=true',
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        reporter: 'junit',
        reporterOptions: 'mochaFile=reports/results-[hash].xml,toConsole=true',
      })
    );
  });

  it('should call `Cypress.run` with provided cypressConfig as project and configFile', async () => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        cypressConfig: 'some/project/my-cypress.json',
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'some/project',
        configFile: 'my-cypress.json',
      })
    );
  });

  it('when devServerTarget AND baseUrl options are both present, baseUrl should take precedence', async () => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        baseUrl: 'test-url-from-options',
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: {
          baseUrl: 'test-url-from-options',
        },
      })
    );
  });

  it('when devServerTarget option present and baseUrl option is absent, baseUrl should come from devServerTarget', async () => {
    const { success } = await cypressExecutor(cypressOptions, mockContext);
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: {
          baseUrl: 'http://localhost:4200',
        },
      })
    );
  });

  it('should call `Cypress.run` without serving the app', async () => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        skipServe: true,
        baseUrl: 'http://my-distant-host.com',
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(runExecutor).not.toHaveBeenCalled();
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          baseUrl: 'http://my-distant-host.com',
        },
      })
    );
  });

  it('should not forward watch option to devServerTarget when not supported', async () => {
    // Simulate a dev server target that does not support watch option.
    (devkit as any).readTargetOptions = jest.fn().mockReturnValue({});

    const { success } = await cypressExecutor(cypressOptions, mockContext);

    expect(success).toEqual(true);
    expect((devkit as any).readTargetOptions.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        project: 'my-app',
        target: 'serve',
      })
    );
    expect(Object.keys(runExecutor.mock.calls[0][1])).not.toContain('watch');
  });

  it('should forward watch option to devServerTarget when supported', async () => {
    // Simulate a dev server target that support watch option.
    (devkit as any).readTargetOptions = jest
      .fn()
      .mockReturnValue({ watch: true });

    const { success } = await cypressExecutor(cypressOptions, mockContext);

    expect(success).toEqual(true);
    expect((devkit as any).readTargetOptions.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        project: 'my-app',
        target: 'serve',
      })
    );
    expect(Object.keys(runExecutor.mock.calls[0][1])).toContain('watch');
  });

  it('should forward testingType', async () => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        testingType: 'component',
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        testingType: 'component',
      })
    );
  });

  it('should forward headed', async () => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        headed: true,
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        headed: true,
      })
    );
  });
});
