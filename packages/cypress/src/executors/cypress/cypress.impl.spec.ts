import type { Mock, MockInstance } from 'vitest';
const mockDetectPortFn = vi.hoisted(() => vi.fn());
vi.mock('detect-port', () => ({ default: mockDetectPortFn }));

import * as devkit from '@nx/devkit';
import { ExecutorContext } from '@nx/devkit';
import { getExecutorInformation } from '@nx/devkit/internal';
import * as path from 'path';
import { getInstalledCypressMajorVersion } from '../../utils/versions';
import cypressExecutor, { CypressExecutorOptions } from './cypress.impl';

vi.mock('@nx/devkit');
vi.mock('nx/src/command-line/run/executor-utils', async () => ({
  ...(await vi.importActual<any>('nx/src/command-line/run/executor-utils')),
  getExecutorInformation: vi.fn(),
}));
vi.mock('../../utils/versions', async () => ({
  ...(await vi.importActual<any>('../../utils/versions')),
  getInstalledCypressMajorVersion: vi.fn(),
}));
const Cypress = require('cypress');

describe('Cypress builder', () => {
  let cypressRun: MockInstance;
  let cypressOpen: MockInstance;
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
  let mockedInstalledCypressMajorVersion: Mock<
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
  vi.mocked(devkit.readTargetOptions).mockReturnValue({
    watch: true,
  });
  (getExecutorInformation as Mock).mockReturnValue({
    schema: { properties: {} },
    hasherFactory: vi.fn(),
    implementationFactory: vi.fn(),
    batchImplementationFactory: vi.fn(),
    isNgCompat: true,
    isNxExecutor: true,
  });
  let runExecutor: any;
  beforeEach(async () => {
    mockedInstalledCypressMajorVersion.mockReturnValue(15);
    // The automocked namespace is read-only, so configure its mocks in place.
    runExecutor = vi.mocked(devkit.runExecutor).mockReturnValue([
      {
        success: true,
        baseUrl: 'http://localhost:4200',
      },
    ] as any);
    vi.mocked(devkit.stripIndents).mockImplementation((s: any) => s);
    vi.mocked(devkit.parseTargetString).mockImplementation((s: string) => {
      const [project, target, configuration] = s.split(':');
      return {
        project,
        target,
        configuration,
      };
    });
    cypressRun = vi.spyOn(Cypress, 'run').mockReturnValue(Promise.resolve({}));
    cypressOpen = vi
      .spyOn(Cypress, 'open')
      .mockReturnValue(Promise.resolve({}));
  });

  afterEach(() => vi.clearAllMocks());

  it('should call `Cypress.run` if headless mode is `true`', async () => {
    const { success } = await cypressExecutor(cypressOptions, mockContext);
    expect(success).toEqual(true);

    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ baseUrl: 'http://localhost:4200' }),
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
        config: expect.objectContaining({ baseUrl: 'http://localhost:4200' }),
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
    expect(cypressRun).not.toHaveBeenCalled();
  });

  it('should fail early if application build fails', async () => {
    vi.mocked(devkit.runExecutor).mockReturnValue([
      {
        success: false,
      },
    ] as any);
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
    expect(cypressRun).toHaveBeenCalledWith(
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
        config: expect.objectContaining({
          baseUrl: 'test-url-from-options',
        }),
      })
    );
  });

  it('when devServerTarget option present and baseUrl option is absent, baseUrl should come from devServerTarget', async () => {
    const { success } = await cypressExecutor(cypressOptions, mockContext);
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenLastCalledWith(
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
    expect(runExecutor).not.toHaveBeenCalled();
    expect(cypressRun).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          baseUrl: 'http://my-distant-host.com',
        }),
      })
    );
  });

  it('should not forward watch option to devServerTarget when not supported', async () => {
    // Simulate a dev server target that does not support watch option.
    vi.mocked(devkit.readTargetOptions).mockReturnValue({});

    const { success } = await cypressExecutor(cypressOptions, mockContext);

    expect(success).toEqual(true);
    expect(vi.mocked(devkit.readTargetOptions).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        project: 'my-app',
        target: 'serve',
      })
    );
    expect(Object.keys(runExecutor.mock.calls[0][1])).not.toContain('watch');
  });

  it('should try to detectPort when a port option is provided', async () => {
    vi.mocked(devkit.readTargetOptions).mockReturnValue({ port: 4200 });
    mockDetectPortFn.mockResolvedValue(4200);

    const { success } = await cypressExecutor(
      { ...cypressOptions, port: 'cypress-auto' },
      mockContext
    );
    expect(success).toEqual(true);
    expect(mockDetectPortFn).toHaveBeenCalledWith(4200);
  });

  it('should forward watch option to devServerTarget when supported', async () => {
    // Simulate a dev server target that support watch option.
    vi.mocked(devkit.readTargetOptions).mockReturnValue({ watch: true });

    const { success } = await cypressExecutor(cypressOptions, mockContext);

    expect(success).toEqual(true);
    expect(vi.mocked(devkit.readTargetOptions).mock.calls[0][0]).toEqual(
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
