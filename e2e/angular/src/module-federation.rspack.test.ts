import { names, stripIndents } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  killProcessAndPorts,
  newProject,
  readFile,
  runCLI,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';

describe('Angular Module Federation', () => {
  let proj: string;
  let oldVerboseLoggingValue: string;

  beforeAll(() => {
    proj = newProject({ packages: ['@nx/angular'] });
    oldVerboseLoggingValue = process.env.NX_E2E_VERBOSE_LOGGING;
    process.env.NX_E2E_VERBOSE_LOGGING = 'true';
  });
  afterAll(() => {
    cleanupProject();
    process.env.NX_E2E_VERBOSE_LOGGING = oldVerboseLoggingValue;
  });

  it('should generate valid host and remote apps', async () => {
    const hostApp = uniq('app');
    const remoteApp1 = uniq('remote');
    const sharedLib = uniq('shared-lib');
    const wildcardLib = uniq('wildcard-lib');
    const secondaryEntry = uniq('secondary');
    const hostPort = 4300;
    const remotePort = 4301;

    // generate host app
    runCLI(
      `generate @nx/angular:host ${hostApp} --style=css --bundler=rspack --no-standalone --no-interactive`
    );
    let rspackConfigFileContents = readFile(join(hostApp, 'rspack.config.ts'));
    let updatedConfigFileContents = rspackConfigFileContents.replace(
      `maximumError: '1mb'`,
      `maximumError: '3mb'`
    );
    updateFile(join(hostApp, 'rspack.config.ts'), updatedConfigFileContents);

    // generate remote app
    runCLI(
      `generate @nx/angular:remote ${remoteApp1} --host=${hostApp} --bundler=rspack --port=${remotePort} --style=css --no-standalone --no-interactive`
    );
    rspackConfigFileContents = readFile(join(remoteApp1, 'rspack.config.ts'));
    updatedConfigFileContents = rspackConfigFileContents.replace(
      `maximumError: '1mb'`,
      `maximumError: '3mb'`
    );
    updateFile(join(remoteApp1, 'rspack.config.ts'), updatedConfigFileContents);

    // check files are generated without the layout directory ("apps/")
    checkFilesExist(
      `${hostApp}/src/app/app-module.ts`,
      `${remoteApp1}/src/app/app-module.ts`
    );

    // check default generated host is built successfully
    const buildOutput = runCLI(`build ${hostApp}`, {
      env: { NODE_ENV: 'production' },
    });
    expect(buildOutput).toContain('Successfully ran target build');

    // generate a shared lib with a seconary entry point
    runCLI(
      `generate @nx/angular:library ${sharedLib} --buildable --no-standalone --no-interactive`
    );
    runCLI(
      `generate @nx/angular:library-secondary-entry-point --library=${sharedLib} --name=${secondaryEntry} --no-interactive`
    );

    // Add a library that will be accessed via a wildcard in tspath mappings
    runCLI(
      `generate @nx/angular:library ${wildcardLib} --buildable --no-standalone --no-interactive`
    );

    updateJson('tsconfig.base.json', (json) => {
      delete json.compilerOptions.paths[`@${proj}/${wildcardLib}`];
      json.compilerOptions.paths[`@${proj}/${wildcardLib}/*`] = [
        `./${wildcardLib}/src/lib/*`,
      ];
      return json;
    });

    // update host & remote files to use shared library
    updateFile(
      `${hostApp}/src/app/app-module.ts`,
      `import { NgModule } from '@angular/core';
      import { BrowserModule } from '@angular/platform-browser';
      import { ${
        names(wildcardLib).className
      }Module } from '@${proj}/${wildcardLib}/${
        names(secondaryEntry).fileName
      }-module';
      import { ${
        names(sharedLib).className
      }Module } from '@${proj}/${sharedLib}';
      import { ${
        names(secondaryEntry).className
      }Module } from '@${proj}/${sharedLib}/${secondaryEntry}';
      import { App } from './app';
      import { NxWelcome } from './nx-welcome';
      import { RouterModule } from '@angular/router';

      @NgModule({
        declarations: [App, NxWelcome],
        imports: [
          BrowserModule,
          ${names(sharedLib).className}Module,
          ${names(wildcardLib).className}Module,
          RouterModule.forRoot(
            [
              {
                path: '${remoteApp1}',
                loadChildren: () =>
                  import('${remoteApp1}/Module').then(
                    (m) => m.RemoteEntryModule
                  ),
              },
            ],
            { initialNavigation: 'enabledBlocking' }
          ),
        ],
        providers: [],
        bootstrap: [App],
      })
      export class AppModule {}
      `
    );
    updateFile(
      `${remoteApp1}/src/app/remote-entry/entry-module.ts`,
      `import { NgModule } from '@angular/core';
    import { CommonModule } from '@angular/common';
    import { RouterModule } from '@angular/router';
    import { ${names(sharedLib).className}Module } from '@${proj}/${sharedLib}';
      import { ${
        names(secondaryEntry).className
      }Module } from '@${proj}/${sharedLib}/${secondaryEntry}';
    import { RemoteEntry } from './entry';
    import { NxWelcome } from './nx-welcome';

    @NgModule({
      declarations: [RemoteEntry, NxWelcome],
      imports: [
        CommonModule,
        ${names(sharedLib).className}Module,
        RouterModule.forChild([
          {
            path: '',
            component: RemoteEntry,
          },
        ]),
      ],
      providers: [],
    })
    export class RemoteEntryModule {}
    `
    );

    const processSwc = await runCommandUntil(
      `serve ${remoteApp1}`,
      (output) =>
        !output.includes(`Remote '${remoteApp1}' failed to serve correctly`) &&
        output.includes(`Build at:`)
    );
    await killProcessAndPorts(processSwc.pid, remotePort);
  }, 20_000_000);

  it('should load remote app in the browser via ESM module federation', async () => {
    const hostApp = uniq('host');
    const remoteApp = uniq('remote');
    const hostPort = 4200;
    const remotePort = 4401;

    // generate host with playwright e2e runner
    runCLI(
      `generate @nx/angular:host ${hostApp} --style=css --bundler=rspack --e2eTestRunner=playwright --no-interactive`
    );

    // generate remote
    runCLI(
      `generate @nx/angular:remote ${remoteApp} --host=${hostApp} --bundler=rspack --port=${remotePort} --style=css --no-interactive`
    );

    // Write playwright e2e test that navigates to the remote route.
    // This catches ESM-related runtime errors like "Unexpected token 'export'"
    // which only surface in the browser when loading remoteEntry.js.
    updateFile(
      `${hostApp}-e2e/src/example.spec.ts`,
      stripIndents`
        import { test, expect } from '@playwright/test';

        test('should load the host app', async ({ page }) => {
          await page.goto('/');
          expect(await page.locator('h1').innerText()).toContain('Welcome');
        });

        test('should load the remote app via module federation', async ({ page }) => {
          await page.goto('/${remoteApp}');
          expect(await page.locator('app-nx-welcome').count()).toBeGreaterThan(0);
        });
      `
    );

    if (runE2ETests('playwright')) {
      const e2eProcess = await runCommandUntil(
        `e2e ${hostApp}-e2e`,
        (output) => output.includes('Successfully ran target e2e for project'),
        { timeout: 120000 }
      );
      await killProcessAndPorts(e2eProcess.pid, hostPort, remotePort);
    }
  }, 20_000_000);
});
