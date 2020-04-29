import * as devkitArchitect from '@angular-devkit/architect';
import { Architect } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import * as fsUtility from '@nrwl/workspace';
import { MockBuilderContext } from '@nrwl/workspace/testing';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';
import * as fsExtras from 'fs-extra';
import * as path from 'path';
import { of } from 'rxjs';
import { CypressBuilderOptions, cypressBuilderRunner } from './cypress.impl';

jest.mock('../../utils/cypress-version');
import { installedCypressVersion } from '../../utils/cypress-version';

const Cypress = require('cypress');

describe('Cypress builder', () => {
  let architect: Architect;
  let cypressRun: jasmine.Spy;
  let cypressOpen: jasmine.Spy;
  let fakeEventEmitter: EventEmitter;
  let fork: jasmine.Spy;
  let cypressConfig: any;
  let mockedBuilderContext: MockBuilderContext;
  let mockedInstalledCypressVersion: jest.Mock<ReturnType<
    typeof installedCypressVersion
  >> = installedCypressVersion as any;
  const cypressBuilderOptions: CypressBuilderOptions = {
    cypressConfig: 'apps/my-app-e2e/cypress.json',
    parallel: false,
    tsConfig: 'apps/my-app-e2e/tsconfig.json',
    devServerTarget: 'my-app:serve',
    headless: true,
    exit: true,
    record: false,
    baseUrl: undefined,
    watch: false,
  };

  beforeEach(async () => {
    const registry = new schema.CoreSchemaRegistry();
    registry.addPostTransform(schema.transforms.addUndefinedDefaults);
    const testArchitectHost = new TestingArchitectHost('/root', '/root');

    architect = new Architect(testArchitectHost, registry);
    await testArchitectHost.addBuilderFromPackage(
      path.join(__dirname, '../../..')
    );

    mockedBuilderContext = new MockBuilderContext(architect, testArchitectHost);

    (devkitArchitect as any).scheduleTargetAndForget = jest
      .fn()
      .mockReturnValue(
        of({
          success: true,
          baseUrl: 'http://localhost:4200',
        })
      );
    fakeEventEmitter = new EventEmitter();
    fork = spyOn(child_process, 'fork').and.returnValue(fakeEventEmitter);
    cypressRun = spyOn(Cypress, 'run').and.returnValue(Promise.resolve({}));
    cypressOpen = spyOn(Cypress, 'open').and.returnValue(Promise.resolve({}));
    cypressConfig = {
      fixturesFolder: './src/fixtures',
      integrationFolder: './src/integration',
    };
    spyOn(fsUtility, 'readJsonFile').and.callFake((path) => {
      return path.endsWith('tsconfig.json')
        ? {
            compilerOptions: {
              outDir: '../../dist/out-tsc/apps/my-app-e2e/src',
            },
          }
        : cypressConfig;
    });
    spyOn(fsExtras, 'copySync');
    spyOn(process, 'exit');
  });

  it('should call `Cypress.run` if headless mode is `true`', async (done) => {
    const run = await architect.scheduleBuilder(
      '@nrwl/cypress:cypress',
      cypressBuilderOptions
    );
    run.result.then(async () => {
      await run.stop();
      expect(cypressRun).toHaveBeenCalledWith(
        jasmine.objectContaining({
          config: { baseUrl: 'http://localhost:4200' },
          project: path.dirname(cypressBuilderOptions.cypressConfig),
        })
      );
      expect(cypressOpen).not.toHaveBeenCalled();
      done();
    });
    fakeEventEmitter.emit('exit', 0); // Passing tsc command
  });

  it('should call `Cypress.open` if headless mode is `false`', async (done) => {
    const run = await architect.scheduleBuilder('@nrwl/cypress:cypress', {
      ...cypressBuilderOptions,
      headless: false,
      watch: true,
    });
    run.result.then(async () => {
      await run.stop();
      expect(cypressOpen).toHaveBeenCalledWith(
        jasmine.objectContaining({
          config: { baseUrl: 'http://localhost:4200' },
          project: path.dirname(cypressBuilderOptions.cypressConfig),
        })
      );
      expect(cypressRun).not.toHaveBeenCalled();
      done();
    });
    fakeEventEmitter.emit('exit', 0); // Passing tsc command
  });

  it('should call `Cypress.run` with provided baseUrl', async (done) => {
    const run = await architect.scheduleBuilder('@nrwl/cypress:cypress', {
      ...cypressBuilderOptions,
      devServerTarget: undefined,
      baseUrl: 'http://my-distant-host.com',
    });
    run.result.then(async () => {
      await run.stop();
      expect(cypressRun).toHaveBeenCalledWith(
        jasmine.objectContaining({
          config: {
            baseUrl: 'http://my-distant-host.com',
          },
          project: path.dirname(cypressBuilderOptions.cypressConfig),
        })
      );
      done();
      expect(cypressOpen).not.toHaveBeenCalled();
    });

    fakeEventEmitter.emit('exit', 0); // Passing tsc command
  });

  it('should call `Cypress.run` with provided browser', async (done) => {
    const run = await architect.scheduleBuilder('@nrwl/cypress:cypress', {
      ...cypressBuilderOptions,
      browser: 'chrome',
    });
    run.result.then(async () => {
      await run.stop();
      expect(cypressRun).toHaveBeenCalledWith(
        jasmine.objectContaining({
          browser: 'chrome',
          project: path.dirname(cypressBuilderOptions.cypressConfig),
        })
      );
      expect(cypressOpen).not.toHaveBeenCalled();
      done();
    });

    fakeEventEmitter.emit('exit', 0); // Passing tsc command
  });

  it('should call `Cypress.run` without baseUrl nor dev server target value', async (done) => {
    const run = await architect.scheduleBuilder('@nrwl/cypress:cypress', {
      cypressConfig: 'apps/my-app-e2e/cypress.json',
      tsConfig: 'apps/my-app-e2e/tsconfig.json',
      devServerTarget: undefined,
      headless: true,
      exit: true,
      parallel: false,
      record: false,
      baseUrl: undefined,
      watch: false,
    });
    run.result.then(async () => {
      await run.stop();
      expect(cypressRun).toHaveBeenCalledWith(
        jasmine.objectContaining({
          project: path.dirname(cypressBuilderOptions.cypressConfig),
        })
      );
      expect(cypressOpen).not.toHaveBeenCalled();
      done();
    });

    fakeEventEmitter.emit('exit', 0); // Passing tsc command
  });

  it('should fail early if application build fails', async (done) => {
    (devkitArchitect as any).scheduleTargetAndForget = jest
      .fn()
      .mockReturnValue(
        of({
          success: false,
        })
      );
    const run = await architect.scheduleBuilder(
      '@nrwl/cypress:cypress',
      cypressBuilderOptions
    );
    run.result.then(async (res) => {
      await run.stop();
      expect(res.success).toBe(false);
      done();
    });
  });

  it('should call `Cypress.run` with provided cypressConfig as project and configFile', async (done) => {
    const cfg = {
      ...cypressBuilderOptions,
      cypressConfig: 'some/project/my-cypress.json',
    };

    const run = await architect.scheduleBuilder('@nrwl/cypress:cypress', cfg);
    run.result.then(async () => {
      await run.stop();
      expect(cypressRun).toHaveBeenCalledWith(
        jasmine.objectContaining({
          project: path.dirname(cfg.cypressConfig),
          configFile: path.basename(cfg.cypressConfig),
        })
      );
      expect(cypressOpen).not.toHaveBeenCalled();
      done();
    });

    fakeEventEmitter.emit('exit', 0); // Passing tsc command
  });

  it('should show warnings if using unsupported browsers v3', async (done) => {
    mockedInstalledCypressVersion.mockReturnValue(3);
    const result = await cypressBuilderRunner(
      { ...cypressBuilderOptions, browser: 'edge' },
      mockedBuilderContext
    ).toPromise();

    expect(
      mockedBuilderContext.logger.includes(
        'You are using a browser that is not supported by cypress v3.'
      )
    ).toBeTruthy();
    done();
  });

  it('should show warnings if using unsupported browsers v4', async (done) => {
    mockedInstalledCypressVersion.mockReturnValue(4);

    const result = await cypressBuilderRunner(
      { ...cypressBuilderOptions, browser: 'canary' },
      mockedBuilderContext
    ).toPromise();

    expect(
      mockedBuilderContext.logger.includes(
        'You are using a browser that is not supported by cypress v4+.'
      )
    ).toBeTruthy();
    done();
  });

  describe('legacy', () => {
    beforeEach(() => {
      cypressConfig = {
        fixturesFolder: '../../dist/out-tsc/apps/my-app-e2e/src/fixtures',
        integrationFolder: '../../dist/out-tsc/apps/my-app-e2e/src/integration',
      };
    });

    it('should call `fork.child_process` with the tsc command', async () => {
      const run = await architect.scheduleBuilder(
        '@nrwl/cypress:cypress',
        cypressBuilderOptions
      );
      fakeEventEmitter.emit('exit', 0);
      await run.result;
      await run.stop();
      expect(fork).toHaveBeenCalledWith(
        '/root/node_modules/typescript/bin/tsc',
        ['-p', '/root/apps/my-app-e2e/tsconfig.json'],
        { stdio: [0, 1, 2, 'ipc'] }
      );
    });

    it('should copy fixtures folder to out-dir', async (done) => {
      const run = await architect.scheduleBuilder(
        '@nrwl/cypress:cypress',
        cypressBuilderOptions
      );
      run.result.then(async () => {
        await run.stop();
        expect(
          fsExtras.copySync
        ).toHaveBeenCalledWith(
          '/root/apps/my-app-e2e/src/fixtures',
          '/root/dist/out-tsc/apps/my-app-e2e/src/fixtures',
          { overwrite: true }
        );
        done();
      });

      fakeEventEmitter.emit('exit', 0); // Passing tsc command
    });

    it('should not copy fixtures folder if they are not defined in the cypress config', async (done) => {
      delete cypressConfig.fixturesFolder;
      const run = await architect.scheduleBuilder(
        '@nrwl/cypress:cypress',
        cypressBuilderOptions
      );
      run.result.then(async () => {
        await run.stop();
        expect(fsExtras.copySync).not.toHaveBeenCalled();
        done();
      });

      fakeEventEmitter.emit('exit', 0); // Passing tsc command
    });

    it('should copy regex files to out-dir', async (done) => {
      const regex: string = '^.+\\.feature$';

      const run = await architect.scheduleBuilder('@nrwl/cypress:cypress', {
        ...cypressBuilderOptions,
        copyFiles: regex,
      });
      run.result.then(async () => {
        await run.stop();
        expect(
          fsExtras.copySync
        ).toHaveBeenCalledWith(
          '/root/apps/my-app-e2e/src/integration',
          '/root/dist/out-tsc/apps/my-app-e2e/src/integration',
          { filter: jasmine.any(Function) }
        );
        done();
      });

      fakeEventEmitter.emit('exit', 0); // Passing tsc command
    });

    it('should not copy regex files if the regex is not defined', async (done) => {
      const regex: string = undefined;

      const run = await architect.scheduleBuilder('@nrwl/cypress:cypress', {
        ...cypressBuilderOptions,
        copyFiles: regex,
      });
      run.result.then(async () => {
        await run.stop();
        expect(
          fsExtras.copySync
        ).not.toHaveBeenCalledWith(
          '/root/apps/my-app-e2e/src/integration',
          '/root/dist/out-tsc/apps/my-app-e2e/src/integration',
          { filter: jasmine.any(Function) }
        );
        done();
      });

      fakeEventEmitter.emit('exit', 0); // Passing tsc command
    });

    it('should not copy regex files if the integration files are not defined in the cypress config', async (done) => {
      delete cypressConfig.integrationFolder;

      const regex: string = '^.+\\.feature$';

      const run = await architect.scheduleBuilder('@nrwl/cypress:cypress', {
        ...cypressBuilderOptions,
        copyFiles: regex,
      });
      run.result
        .then(async () => {
          await run.stop();
          fail();
        })
        .catch(async () => {
          await run.stop();
          done();
        });

      fakeEventEmitter.emit('exit', 0); // Passing tsc command
    });

    it('should fail early if integration files fail to compile', async (done) => {
      const run = await architect.scheduleBuilder(
        '@nrwl/cypress:cypress',
        cypressBuilderOptions
      );
      run.result.then(async (res) => {
        await run.stop();
        expect(res.success).toBe(false);
        done();
      });

      fakeEventEmitter.emit('exit', 1); // Passing tsc command
    });
  });
});
