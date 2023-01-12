import {
  cleanupProject,
  newProject,
  promisifiedTreeKill,
  readProjectConfig,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';
import { ChildProcess } from 'child_process';

import { names } from '@nrwl/devkit';

describe('Angular Projects', () => {
  let proj: string;

  beforeAll(() => (proj = newProject()));
  afterAll(() => cleanupProject());

  it('should serve the host and remote apps successfully, even with a shared library with a secondary entry point between them', async () => {
    // ACT + ASSERT
    const port1 = 4200;
    const port2 = 4206;
    const hostApp = uniq('app');
    const remoteApp1 = uniq('remote');
    const sharedLib = uniq('shared-lib');
    const secondaryEntry = uniq('secondary');

    // generate host app
    runCLI(
      `generate @nrwl/angular:host ${hostApp} --style=css --no-interactive`
    );

    // generate remote apps
    runCLI(
      `generate @nrwl/angular:remote ${remoteApp1} --host=${hostApp} --port=${port2} --style=css --no-interactive`
    );

    // generate a shared lib
    runCLI(
      `generate @nrwl/angular:library ${sharedLib} --buildable --no-interactive`
    );
    runCLI(
      `generate @nrwl/angular:library-secondary-entry-point --library=${sharedLib} --name=${secondaryEntry} --no-interactive`
    );

    // update the files to use shared library
    updateFile(
      `apps/${hostApp}/src/app/app.module.ts`,
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
      `apps/${remoteApp1}/src/app/remote-entry/entry.module.ts`,
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

    let process: ChildProcess;

    try {
      process = await runCommandUntil(
        `serve ${hostApp} --dev-remotes=${remoteApp1}`,
        (output) => {
          return (
            output.includes(`listening on localhost:${port2}`) &&
            output.includes(`listening on localhost:${port1}`)
          );
        }
      );
    } catch (err) {
      console.error(err);
    }

    // port and process cleanup
    try {
      if (process && process.pid) {
        await promisifiedTreeKill(process.pid, 'SIGKILL');
      }
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 300000);

  it('should build the host app successfully', async () => {
    // ARRANGE
    const hostApp = uniq('app');
    const remoteApp1 = uniq('remote');

    // generate host app
    runCLI(`generate @nrwl/angular:host ${hostApp} --no-interactive`);

    // generate remote apps
    runCLI(
      `generate @nrwl/angular:remote ${remoteApp1} --host=${hostApp} --no-interactive`
    );

    // ACT
    const buildOutput = runCLI(`build ${hostApp}`);

    // ASSERT
    expect(buildOutput).toContain('Successfully ran target build');
  }, 300000);

  it('should serve a ssr remote app successfully', async () => {
    // ARRANGE
    const remoteApp1 = uniq('remote');
    // generate remote apps
    runCLI(
      `generate @nrwl/angular:remote ${remoteApp1} --ssr --no-interactive`
    );

    let process = await runCommandUntil(`serve-ssr ${remoteApp1}`, (output) => {
      return (
        output.includes(`Browser application bundle generation complete.`) &&
        output.includes(`Server application bundle generation complete.`) &&
        output.includes(
          `Angular Universal Live Development Server is listening`
        )
      );
    });

    // port and process cleanup
    try {
      if (process && process.pid) {
        await promisifiedTreeKill(process.pid, 'SIGKILL');
      }
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 10_000_000);

  it('should scaffold a ssr MF setup successfully', async () => {
    // ARRANGE
    const remoteApp1 = uniq('remote1');
    const remoteApp2 = uniq('remote2');
    const hostApp = uniq('host1');
    // generate remote apps
    runCLI(
      `generate @nrwl/angular:host ${hostApp} --ssr --remotes=${remoteApp1},${remoteApp2} --no-interactive`
    );

    // ports
    const remoteApp1Port =
      readProjectConfig(remoteApp1).targets.serve.options.port;
    const remoteApp2Port =
      readProjectConfig(remoteApp2).targets.serve.options.port;

    let process = await runCommandUntil(`serve-ssr ${hostApp}`, (output) => {
      return (
        output.includes(
          `Node Express server listening on http://localhost:${remoteApp1Port}`
        ) &&
        output.includes(
          `Node Express server listening on http://localhost:${remoteApp2Port}`
        ) &&
        output.includes(
          `Angular Universal Live Development Server is listening`
        )
      );
    });

    // port and process cleanup
    try {
      if (process && process.pid) {
        await promisifiedTreeKill(process.pid, 'SIGKILL');
      }
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 10_000_000);

  it('Custom Webpack Config for SSR - should serve the app correctly', async () => {
    // ARRANGE
    const ssrApp = uniq('app');

    runCLI(`generate @nrwl/angular:app ${ssrApp} --no-interactive`);
    runCLI(`generate @nrwl/angular:setup-ssr ${ssrApp} --no-interactive`);

    updateProjectConfig(ssrApp, (project) => {
      project.targets.server.executor = '@nrwl/angular:webpack-server';
      return project;
    });

    // ACT
    let process = await runCommandUntil(`serve-ssr ${ssrApp}`, (output) => {
      return output.includes(
        `Angular Universal Live Development Server is listening on http://localhost:4200`
      );
    });

    // port and process cleanup
    try {
      if (process && process.pid) {
        await promisifiedTreeKill(process.pid, 'SIGKILL');
      }
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 300000);
});
