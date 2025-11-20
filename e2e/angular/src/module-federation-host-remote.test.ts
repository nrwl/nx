import { names } from '@nx/devkit';
import {
  checkFilesExist,
  killProcessAndPorts,
  readJson,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';
import {
  setupModuleFederationTest,
  cleanupModuleFederationTest,
  ModuleFederationTestSetup,
} from './module-federation-setup';

describe('Angular Module Federation - Host and Remote', () => {
  let setup: ModuleFederationTestSetup;

  beforeAll(() => {
    setup = setupModuleFederationTest();
  });

  afterAll(() => cleanupModuleFederationTest(setup));

  it('should generate valid host and remote apps', async () => {
    const { proj } = setup;
    const hostApp = uniq('app');
    const remoteApp1 = uniq('remote');
    const sharedLib = uniq('shared-lib');
    const wildcardLib = uniq('wildcard-lib');
    const secondaryEntry = uniq('secondary');
    const hostPort = 4300;
    const remotePort = 4301;

    // generate host app
    runCLI(
      `generate @nx/angular:host ${hostApp} --style=css --no-standalone --no-interactive`
    );
    // generate remote app
    runCLI(
      `generate @nx/angular:remote ${remoteApp1} --host=${hostApp} --port=${remotePort} --style=css --no-standalone --no-interactive`
    );

    // check files are generated without the layout directory ("apps/")
    checkFilesExist(
      `${hostApp}/src/app/app-module.ts`,
      `${remoteApp1}/src/app/app-module.ts`
    );

    // check default generated host is built successfully
    const buildOutput = runCLI(`build ${hostApp}`);
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
        `${wildcardLib}/src/lib/*`,
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
        names(wildcardLib).fileName
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
      `serve ${hostApp} --port=${hostPort} --dev-remotes=${remoteApp1}`,
      (output) =>
        !output.includes(`Remote '${remoteApp1}' failed to serve correctly`) &&
        output.includes(`listening on localhost:${hostPort}`)
    );
    await killProcessAndPorts(processSwc.pid, hostPort, remotePort);

    const processTsNode = await runCommandUntil(
      `serve ${hostApp} --port=${hostPort} --dev-remotes=${remoteApp1}`,
      (output) =>
        !output.includes(`Remote '${remoteApp1}' failed to serve correctly`) &&
        output.includes(`listening on localhost:${hostPort}`),
      { env: { NX_PREFER_TS_NODE: 'true' } }
    );

    await killProcessAndPorts(processTsNode.pid, hostPort, remotePort);
  }, 20_000_000);

  it('should convert apps to MF successfully', async () => {
    const app1 = uniq('app1');
    const app2 = uniq('app2');
    const app1Port = 4400;
    const app2Port = 4401;

    // generate apps
    runCLI(
      `generate @nx/angular:application ${app1} --routing --bundler=webpack --no-interactive`
    );
    runCLI(
      `generate @nx/angular:application ${app2} --bundler=webpack --no-interactive`
    );

    // convert apps
    runCLI(
      `generate @nx/angular:setup-mf ${app1} --mfType=host --port=${app1Port} --no-interactive`
    );
    runCLI(
      `generate @nx/angular:setup-mf ${app2} --mfType=remote --host=${app1} --port=${app2Port} --no-interactive`
    );

    const processSwc = await runCommandUntil(
      `serve ${app1} --dev-remotes=${app2}`,
      (output) =>
        !output.includes(`Remote '${app2}' failed to serve correctly`) &&
        output.includes(`listening on localhost:${app1Port}`)
    );

    await killProcessAndPorts(processSwc.pid, app1Port, app2Port);

    const processTsNode = await runCommandUntil(
      `serve ${app1} --dev-remotes=${app2}`,
      (output) =>
        !output.includes(`Remote '${app2}' failed to serve correctly`) &&
        output.includes(`listening on localhost:${app1Port}`),
      { env: { NX_PREFER_TS_NODE: 'true' } }
    );

    await killProcessAndPorts(processTsNode.pid, app1Port, app2Port);
  }, 20_000_000);
});
