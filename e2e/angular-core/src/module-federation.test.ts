import { names } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  killProcessAndPorts,
  newProject,
  readJson,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('Angular Module Federation', () => {
  let proj: string;
  let oldVerboseLoggingValue: string;
  console.log('Hello Katerina');

  beforeAll(() => {
    proj = newProject();
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
    const secondaryEntry = uniq('secondary');
    const hostPort = 4300;
    const remotePort = 4301;

    // generate host app
    runCLI(
      `generate @nx/angular:host ${hostApp} --style=css --project-name-and-root-format=as-provided --no-interactive`
    );
    // generate remote app
    runCLI(
      `generate @nx/angular:remote ${remoteApp1} --host=${hostApp} --port=${remotePort} --style=css --project-name-and-root-format=as-provided --no-interactive`
    );

    // check files are generated without the layout directory ("apps/")
    checkFilesExist(
      `${hostApp}/src/app/app.module.ts`,
      `${remoteApp1}/src/app/app.module.ts`
    );

    // check default generated host is built successfully
    const buildOutput = runCLI(`build ${hostApp}`);
    expect(buildOutput).toContain('Successfully ran target build');

    // generate a shared lib with a seconary entry point
    runCLI(
      `generate @nx/angular:library ${sharedLib} --buildable --project-name-and-root-format=as-provided --no-interactive`
    );
    runCLI(
      `generate @nx/angular:library-secondary-entry-point --library=${sharedLib} --name=${secondaryEntry} --no-interactive`
    );
    // update host & remote files to use shared library
    updateFile(
      `${hostApp}/src/app/app.module.ts`,
      `import { NgModule } from '@angular/core';
      import { BrowserModule } from '@angular/platform-browser';
      import { ${
        names(sharedLib).className
      }Module } from '@${proj}/${sharedLib}';
      import { ${
        names(secondaryEntry).className
      }Module } from '@${proj}/${secondaryEntry}';
      import { AppComponent } from './app.component';
      import { NxWelcomeComponent } from './nx-welcome.component';
      import { RouterModule } from '@angular/router';

      @NgModule({
        declarations: [AppComponent, NxWelcomeComponent],
        imports: [
          BrowserModule,
          SharedModule,
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
        bootstrap: [AppComponent],
      })
      export class AppModule {}
      `
    );
    updateFile(
      `${remoteApp1}/src/app/remote-entry/entry.module.ts`,
      `import { NgModule } from '@angular/core';
    import { CommonModule } from '@angular/common';
    import { RouterModule } from '@angular/router';
    import { ${names(sharedLib).className}Module } from '@${proj}/${sharedLib}';
      import { ${
        names(secondaryEntry).className
      }Module } from '@${proj}/${secondaryEntry}';
    import { RemoteEntryComponent } from './entry.component';

    @NgModule({
      declarations: [RemoteEntryComponent],
      imports: [
        CommonModule,
        SharedModule,
        RouterModule.forChild([
          {
            path: '',
            component: RemoteEntryComponent,
          },
        ]),
      ],
      providers: [],
    })
    export class RemoteEntryModule {}
    `
    );

    const process = await runCommandUntil(
      `serve ${hostApp} --port=${hostPort} --dev-remotes=${remoteApp1}`,
      (output) =>
        output.includes(`listening on localhost:${remotePort}`) &&
        output.includes(`listening on localhost:${hostPort}`)
    );

    // port and process cleanup
    await killProcessAndPorts(process.pid, hostPort, remotePort);
  }, 20_000_000);

  it('should convert apps to MF successfully', async () => {
    const app1 = uniq('app1');
    const app2 = uniq('app2');
    const app1Port = 4400;
    const app2Port = 4401;

    // generate apps
    runCLI(
      `generate @nx/angular:application ${app1} --routing --project-name-and-root-format=as-provided --no-interactive`
    );
    runCLI(
      `generate @nx/angular:application ${app2} --project-name-and-root-format=as-provided --no-interactive`
    );

    // convert apps
    runCLI(
      `generate @nx/angular:setup-mf ${app1} --mfType=host --port=${app1Port} --no-interactive`
    );
    runCLI(
      `generate @nx/angular:setup-mf ${app2} --mfType=remote --host=${app1} --port=${app2Port} --no-interactive`
    );

    const process = await runCommandUntil(
      `serve ${app1} --dev-remotes=${app2}`,
      (output) =>
        output.includes(`listening on localhost:${app1Port}`) &&
        output.includes(`listening on localhost:${app2Port}`)
    );

    // port and process cleanup
    await killProcessAndPorts(process.pid, app1Port, app2Port);
  }, 20_000_000);

  it('should scaffold MF + SSR setup successfully', async () => {
    const host = uniq('host');
    const remote1 = uniq('remote1');
    const remote2 = uniq('remote2');

    // generate remote apps
    runCLI(
      `generate @nx/angular:host ${host} --ssr --remotes=${remote1},${remote2} --project-name-and-root-format=as-provided --no-interactive`
    );

    // ports
    const hostPort = 4500;
    const remote1Port = readJson(join(remote1, 'project.json')).targets.serve
      .options.port;
    const remote2Port = readJson(join(remote2, 'project.json')).targets.serve
      .options.port;

    const process = await runCommandUntil(
      `serve-ssr ${host} --port=${hostPort}`,
      (output) =>
        output.includes(
          `Node Express server listening on http://localhost:${remote1Port}`
        ) &&
        output.includes(
          `Node Express server listening on http://localhost:${remote2Port}`
        ) &&
        output.includes(
          `Angular Universal Live Development Server is listening`
        )
    );

    // port and process cleanup
    await killProcessAndPorts(process.pid, hostPort, remote1Port, remote2Port);
  }, 20_000_000);

  it('should should support generating host and remote apps with --project-name-and-root-format=derived', async () => {
    const hostApp = uniq('host');
    const remoteApp = uniq('remote');
    const hostPort = 4800;
    const remotePort = 4801;

    // generate host app
    runCLI(
      `generate @nx/angular:host ${hostApp} --project-name-and-root-format=derived --no-interactive`
    );
    // generate remote app
    runCLI(
      `generate @nx/angular:remote ${remoteApp} --host=${hostApp} --port=${remotePort} --project-name-and-root-format=derived --no-interactive`
    );

    // check files are generated with the layout directory ("apps/")
    checkFilesExist(
      `apps/${hostApp}/src/app/app.module.ts`,
      `apps/${remoteApp}/src/app/app.module.ts`
    );

    // check default generated host is built successfully
    const buildOutput = runCLI(`build ${hostApp}`);
    expect(buildOutput).toContain('Successfully ran target build');

    const process = await runCommandUntil(
      `serve ${hostApp} --port=${hostPort} --dev-remotes=${remoteApp}`,
      (output) =>
        output.includes(`listening on localhost:${remotePort}`) &&
        output.includes(`listening on localhost:${hostPort}`)
    );

    // port and process cleanup
    await killProcessAndPorts(process.pid, hostPort, remotePort);
  }, 20_000_000);
});
