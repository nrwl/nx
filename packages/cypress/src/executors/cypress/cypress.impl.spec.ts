import { ExecutorContext, stripIndents } from '@nx/devkit';
import * as detectPort from 'detect-port';
import * as executorUtils from 'nx/src/command-line/run/executor-utils';
import * as path from 'path';
import { getTempTailwindPath } from '../../utils/ct-helpers';
import { getInstalledCypressMajorVersion } from '../../utils/versions';
import cypressExecutor, { CypressExecutorOptions } from './cypress.impl';

jest.mock('@nx/devkit');
let devkit = require('@nx/devkit');
jest.mock('detect-port', () => jest.fn().mockResolvedValue(4200));
jest.mock('../../utils/versions', () => ({
  ...jest.requireActual('../../utils/versions'),
  getInstalledCypressMajorVersion: jest.fn(),
}));
jest.mock('../../utils/ct-helpers');
const Cypress = require('cypress');

describe('Cypress builder', () => {
  let cypressRun: jest.SpyInstance;
  let cypressOpen: jest.SpyInstance;
  const cypressOptions: CypressExecutorOptions = {
    cypressConfig: 'apps/my-app-e2e/cypress.json',
    parallel: false,
    devServerTarget: 'my-app:serve',
    exit: true,
    record: false,
    baseUrl: undefined,
    watch: false,
    skipServe: false,
  };
  let mockContext: ExecutorContext;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof getInstalledCypressMajorVersion>
  > = getInstalledCypressMajorVersion as any;
  mockContext = {
    root: '/root',
    workspace: { projects: {} },
    projectsConfigurations: {
      projects: {
        'my-app': {
          targets: {
            serve: { executor: '@nx/webpack:webpack', options: {} },
          },
        },
      },
    },
  } as any;
  jest.spyOn(devkit, 'readTargetOptions').mockReturnValue({
    watch: true,
  });
  jest.spyOn(executorUtils, 'getExecutorInformation').mockReturnValue({
    schema: { properties: {} },
    hasherFactory: jest.fn(),
    implementationFactory: jest.fn(),
    batchImplementationFactory: jest.fn(),
    isNgCompat: true,
    isNxExecutor: true,
  });
  let runExecutor: any;
  let mockGetTailwindPath: jest.Mock<ReturnType<typeof getTempTailwindPath>> =
    getTempTailwindPath as any;

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
    (devkit as any).logger = {
      warn: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
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
    const deprecatedMessage = stripIndents`
NOTE:
Support for Cypress versions < 10 is deprecated. Please upgrade to at least Cypress version 10.
A generator to migrate from v8 to v10 is provided. See https://nx.dev/cypress/v10-migration-guide
`;

    // expect the warning about the using < v10 but should not also warn about headless
    expect(devkit.logger.warn).toHaveBeenCalledTimes(1);
    expect(devkit.logger.warn).toHaveBeenCalledWith(deprecatedMessage);
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

  it('should call `Cypress.run` with provided ciBuildId (type: number)', async () => {
    const ciBuildId = 1234;
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        ciBuildId,
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        ciBuildId: ciBuildId.toString(),
      })
    );
  });

  it('should call `Cypress.run` with provided ciBuildId (type: string)', async () => {
    const ciBuildId = 'stringBuildId';
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        devServerTarget: undefined,
        ciBuildId,
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        ciBuildId,
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

  it('should call `Cypress.run` with auto cancellation option', async () => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        autoCancelAfterFailures: false,
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        autoCancelAfterFailures: false,
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

  it('should try to detectPort when a port option is provided', async () => {
    (devkit as any).readTargetOptions = jest
      .fn()
      .mockReturnValue({ port: 4200 });

    const { success } = await cypressExecutor(
      { ...cypressOptions, port: 'cypress-auto' },
      mockContext
    );
    expect(success).toEqual(true);
    expect(detectPort).toHaveBeenCalledWith(4200);
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

  describe('Component Testing', () => {
    beforeEach(() => {
      mockGetTailwindPath.mockReturnValue(undefined);
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
  });
});
