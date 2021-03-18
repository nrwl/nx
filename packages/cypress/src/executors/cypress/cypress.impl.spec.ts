import * as path from 'path';
import cypressExecutor, { CypressExecutorOptions } from './cypress.impl';

jest.mock('@nrwl/devkit');
let devkit = require('@nrwl/devkit');

jest.mock('../../utils/cypress-version');
import { installedCypressVersion } from '../../utils/cypress-version';

const Cypress = require('cypress');

describe('Cypress builder', () => {
  let cypressRun: jasmine.Spy;
  let cypressOpen: jasmine.Spy;
  const cypressOptions: CypressExecutorOptions = {
    cypressConfig: 'apps/my-app-e2e/cypress.json',
    parallel: false,
    tsConfig: 'apps/my-app-e2e/tsconfig.json',
    devServerTarget: 'my-app:serve',
    headless: true,
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
    cypressRun = spyOn(Cypress, 'run').and.returnValue(Promise.resolve({}));
    cypressOpen = spyOn(Cypress, 'open').and.returnValue(Promise.resolve({}));
  });

  it('should call `Cypress.run` if headless mode is `true`', async (done) => {
    const { success } = await cypressExecutor(cypressOptions, mockContext);
    expect(success).toEqual(true);

    expect(cypressRun).toHaveBeenCalledWith(
      jasmine.objectContaining({
        config: { baseUrl: 'http://localhost:4200' },
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
    expect(cypressOpen).not.toHaveBeenCalled();
    done();
  });

  it('should call `Cypress.open` if headless mode is `false`', async (done) => {
    const { success } = await cypressExecutor(
      { ...cypressOptions, headless: false, watch: true },
      mockContext
    );
    expect(success).toEqual(true);

    expect(cypressOpen).toHaveBeenCalledWith(
      jasmine.objectContaining({
        config: { baseUrl: 'http://localhost:4200' },
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
    expect(cypressRun).not.toHaveBeenCalled();
    done();
  });

  it('should fail early if application build fails', async (done) => {
    (devkit as any).runExecutor = jest.fn().mockReturnValue([
      {
        success: false,
      },
    ]);
    try {
      await cypressExecutor(cypressOptions, mockContext);
      fail('Should not execute');
    } catch (e) {}
    done();
  });

  it('should show warnings if using unsupported browsers v3', async (done) => {
    mockedInstalledCypressVersion.mockReturnValue(3);
    await cypressExecutor(
      {
        ...cypressOptions,
        browser: 'edge',
      },
      mockContext
    );

    expect(devkit.logger.warn).toHaveBeenCalled();
    done();
  });

  it('should show warnings if using unsupported browsers v4', async (done) => {
    mockedInstalledCypressVersion.mockReturnValue(4);
    await cypressExecutor(
      {
        ...cypressOptions,
        browser: 'canary',
      },
      mockContext
    );

    expect(devkit.logger.warn).toHaveBeenCalled();
    done();
  });

  it('should call `Cypress.run` with provided baseUrl', async (done) => {
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
      jasmine.objectContaining({
        config: {
          baseUrl: 'http://my-distant-host.com',
        },
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
    done();
  });

  it('should call `Cypress.run` with provided browser', async (done) => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        browser: 'chrome',
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      jasmine.objectContaining({
        browser: 'chrome',
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
    done();
  });

  it('should call `Cypress.run` without baseUrl nor dev server target value', async (done) => {
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
      jasmine.objectContaining({
        project: path.dirname(cypressOptions.cypressConfig),
      })
    );
    done();
  });

  it('should call `Cypress.run` with a string of files to ignore', async (done) => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        ignoreTestFiles: '/some/path/to/a/file.js',
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      jasmine.objectContaining({
        ignoreTestFiles: '/some/path/to/a/file.js',
      })
    );
    done();
  });

  it('should call `Cypress.run` with a reporter and reporterOptions', async (done) => {
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
      jasmine.objectContaining({
        reporter: 'junit',
        reporterOptions: 'mochaFile=reports/results-[hash].xml,toConsole=true',
      })
    );
    done();
  });

  it('should call `Cypress.run` with provided cypressConfig as project and configFile', async (done) => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        cypressConfig: 'some/project/my-cypress.json',
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun).toHaveBeenCalledWith(
      jasmine.objectContaining({
        project: 'some/project',
        configFile: 'my-cypress.json',
      })
    );
    done();
  });

  it('when devServerTarget AND baseUrl options are both present, baseUrl should take precedence', async (done) => {
    const { success } = await cypressExecutor(
      {
        ...cypressOptions,
        baseUrl: 'test-url-from-options',
      },
      mockContext
    );
    expect(success).toEqual(true);
    expect(cypressRun.calls.mostRecent().args[0].config.baseUrl).toBe(
      'test-url-from-options'
    );
    done();
  });

  it('when devServerTarget option present and baseUrl option is absent, baseUrl should come from devServerTarget', async (done) => {
    const { success } = await cypressExecutor(cypressOptions, mockContext);
    expect(success).toEqual(true);
    expect(cypressRun.calls.mostRecent().args[0].config.baseUrl).toBe(
      'http://localhost:4200'
    );
    done();
  });

  it('should call `Cypress.run` without serving the app', async (done) => {
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
      jasmine.objectContaining({
        config: {
          baseUrl: 'http://my-distant-host.com',
        },
      })
    );
    done();
  });
});
