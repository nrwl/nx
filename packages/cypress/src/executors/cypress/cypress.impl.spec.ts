// Mock all modules FIRST - BEFORE any imports
const mockReadTargetOptions = jest.fn();
const mockGetExecutorInformation = jest.fn();
const mockRunExecutor = jest.fn();
const mockStripIndents = jest.fn((s) => s);
const mockParseTargetString = jest.fn((s) => {
  const [project, target, configuration] = s.split(':');
  return { project, target, configuration };
});
const mockLogger = {
  warn: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
};

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  readTargetOptions: mockReadTargetOptions,
  runExecutor: mockRunExecutor,
  stripIndents: mockStripIndents,
  parseTargetString: mockParseTargetString,
  logger: mockLogger,
}));

jest.mock('nx/src/command-line/run/executor-utils', () => ({
  ...jest.requireActual('nx/src/command-line/run/executor-utils'),
  getExecutorInformation: mockGetExecutorInformation,
}));

const mockDetectPort = jest.fn().mockResolvedValue(4200);
jest.mock('detect-port', () => mockDetectPort);

const mockGetInstalledCypressMajorVersion = jest.fn();
jest.mock('../../utils/versions', () => ({
  ...jest.requireActual('../../utils/versions'),
  getInstalledCypressMajorVersion: mockGetInstalledCypressMajorVersion,
}));

const mockGetTempTailwindPath = jest.fn();
jest.mock('../../utils/ct-helpers', () => ({
  ...jest.requireActual('../../utils/ct-helpers'),
  getTempTailwindPath: mockGetTempTailwindPath,
}));

const mockCypressRun = jest.fn().mockResolvedValue({});
const mockCypressOpen = jest.fn().mockResolvedValue({});
jest.mock('cypress', () => ({
  run: mockCypressRun,
  open: mockCypressOpen,
}));

// NOW import - mocks are already in place
import { ExecutorContext } from '@nx/devkit';
import * as path from 'path';
import { getTempTailwindPath } from '../../utils/ct-helpers';
import { getInstalledCypressMajorVersion } from '../../utils/versions';
import cypressExecutor, { CypressExecutorOptions } from './cypress.impl';

describe('Cypress builder', () => {
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

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Set up default mock behavior
    mockGetInstalledCypressMajorVersion.mockReturnValue(15);
    mockReadTargetOptions.mockReturnValue({
      watch: true,
    });
    mockGetExecutorInformation.mockReturnValue({
      schema: { properties: {} },
      hasherFactory: jest.fn(),
      implementationFactory: jest.fn(),
      batchImplementationFactory: jest.fn(),
      isNgCompat: true,
      isNxExecutor: true,
    });
    mockRunExecutor.mockReturnValue([
      {
        success: true,
        baseUrl: 'http://localhost:4200',
      },
    ]);
    mockCypressRun.mockResolvedValue({});
    mockCypressOpen.mockResolvedValue({});
  });

  it('should call `Cypress.run` if headless mode is `true`', async () => {
    const { success } = await cypressExecutor(cypressOptions, mockContext);
    expect(success).toEqual(true);

    expect(mockCypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ baseUrl: 'http://localhost:4200' }),
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
    expect(mockCypressOpen).not.toHaveBeenCalled();
  });

  it('should call `Cypress.open` if headless mode is `false`', async () => {
    const { success } = await cypressExecutor(
      { ...cypressOptions, headless: false, watch: true },
      mockContext
    );
    expect(success).toEqual(true);

    expect(mockCypressOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ baseUrl: 'http://localhost:4200' }),
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
    expect(mockCypressRun).not.toHaveBeenCalled();
  });

  it('should fail early if application build fails', async () => {
    mockRunExecutor.mockReturnValue([
      {
        success: false,
      },
    ]);
    try {
      await cypressExecutor(cypressOptions, mockContext);
      fail('Should not execute');
    } catch (e) {}
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
    expect(mockCypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          baseUrl: 'http://my-distant-host.com',
        }),
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
    expect(mockCypressRun).toHaveBeenCalledWith(
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
    expect(mockCypressRun).toHaveBeenCalledWith(
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
    expect(mockCypressRun).toHaveBeenCalledWith(
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
    expect(mockCypressRun).toHaveBeenCalledWith(
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
    expect(mockCypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          e2e: expect.objectContaining({
            excludeSpecPattern: '/some/path/to/a/file.js',
          }),
        }),
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
    expect(mockCypressRun).toHaveBeenCalledWith(
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
    expect(mockCypressRun).toHaveBeenCalledWith(
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
    expect(mockCypressRun).toHaveBeenCalledWith(
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
    expect(mockCypressRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          baseUrl: 'test-url-from-options',
        }),
      })
    );
  });

  it('when devServerTarget option present and baseUrl option is absent, baseUrl should come from devServerTarget', async () => {
    const { success } = await cypressExecutor(cypressOptions, mockContext);
    expect(success).toEqual(true);
    expect(mockCypressRun).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          baseUrl: 'http://localhost:4200',
        }),
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
    expect(mockRunExecutor).not.toHaveBeenCalled();
    expect(mockCypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          baseUrl: 'http://my-distant-host.com',
        }),
      })
    );
  });

  it('should not forward watch option to devServerTarget when not supported', async () => {
    // Simulate a dev server target that does not support watch option.
    mockReadTargetOptions.mockReturnValue({});

    const { success } = await cypressExecutor(cypressOptions, mockContext);

    expect(success).toEqual(true);
    expect(mockReadTargetOptions.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        project: 'my-app',
        target: 'serve',
      })
    );
    expect(Object.keys(mockRunExecutor.mock.calls[0][1])).not.toContain(
      'watch'
    );
  });

  it('should try to detectPort when a port option is provided', async () => {
    mockReadTargetOptions.mockReturnValue({ port: 4200 });

    const { success } = await cypressExecutor(
      { ...cypressOptions, port: 'cypress-auto' },
      mockContext
    );
    expect(success).toEqual(true);
    expect(mockDetectPort).toHaveBeenCalledWith(4200);
  });

  it('should forward watch option to devServerTarget when supported', async () => {
    // Simulate a dev server target that support watch option.
    mockReadTargetOptions.mockReturnValue({ watch: true });

    const { success } = await cypressExecutor(cypressOptions, mockContext);

    expect(success).toEqual(true);
    expect(mockReadTargetOptions.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        project: 'my-app',
        target: 'serve',
      })
    );
    expect(Object.keys(mockRunExecutor.mock.calls[0][1])).toContain('watch');
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
    expect(mockCypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        headed: true,
      })
    );
  });

  describe('Component Testing', () => {
    beforeEach(() => {
      mockGetTempTailwindPath.mockReturnValue(undefined);
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
      expect(mockCypressRun).toHaveBeenCalledWith(
        expect.objectContaining({
          testingType: 'component',
        })
      );
    });
  });
});
