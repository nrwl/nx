import { names } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  killProcessAndPorts,
  newProject,
  readJson,
  runCLI,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
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
    const secondaryEntry = uniq('secondary');
    const hostPort = 4300;
    const remotePort = 4301;

    // generate host app
    runCLI(
      `generate @nx/angular:host ${hostApp} --style=css --no-standalone --project-name-and-root-format=as-provided --no-interactive`
    );
    // generate remote app
    runCLI(
      `generate @nx/angular:remote ${remoteApp1} --host=${hostApp} --port=${remotePort} --style=css --no-standalone --project-name-and-root-format=as-provided --no-interactive`
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
      `generate @nx/angular:library ${sharedLib} --buildable --no-standalone --project-name-and-root-format=as-provided --no-interactive`
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
      }Module } from '@${proj}/${sharedLib}/${secondaryEntry}';
      import { AppComponent } from './app.component';
      import { NxWelcomeComponent } from './nx-welcome.component';
      import { RouterModule } from '@angular/router';

      @NgModule({
        declarations: [AppComponent, NxWelcomeComponent],
        imports: [
          BrowserModule,
          ${names(sharedLib).className}Module,
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
      }Module } from '@${proj}/${sharedLib}/${secondaryEntry}';
    import { RemoteEntryComponent } from './entry.component';
    import { NxWelcomeComponent } from './nx-welcome.component';

    @NgModule({
      declarations: [RemoteEntryComponent, NxWelcomeComponent],
      imports: [
        CommonModule,
        ${names(sharedLib).className}Module,
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
      `generate @nx/angular:application ${app1} --routing --bundler=webpack --project-name-and-root-format=as-provided --no-interactive`
    );
    runCLI(
      `generate @nx/angular:application ${app2} --bundler=webpack --project-name-and-root-format=as-provided --no-interactive`
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

    const processSwc = await runCommandUntil(
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

    await killProcessAndPorts(
      processSwc.pid,
      hostPort,
      remote1Port,
      remote2Port
    );

    const processTsNode = await runCommandUntil(
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
        ),
      { env: { NX_PREFER_TS_NODE: 'true' } }
    );

    await killProcessAndPorts(
      processTsNode.pid,
      hostPort,
      remote1Port,
      remote2Port
    );
  }, 20_000_000);

  it('should should support generating host and remote apps with --project-name-and-root-format=derived', async () => {
    const hostApp = uniq('host');
    const remoteApp = uniq('remote');
    const hostPort = 4800;
    const remotePort = 4801;

    // generate host app
    runCLI(
      `generate @nx/angular:host ${hostApp} --no-standalone --project-name-and-root-format=derived --no-interactive`
    );
    // generate remote app
    runCLI(
      `generate @nx/angular:remote ${remoteApp} --host=${hostApp} --port=${remotePort} --no-standalone --project-name-and-root-format=derived --no-interactive`
    );

    // check files are generated with the layout directory ("apps/")
    checkFilesExist(
      `apps/${hostApp}/src/app/app.module.ts`,
      `apps/${remoteApp}/src/app/app.module.ts`
    );

    // check default generated host is built successfully
    const buildOutputSwc = await runCommandUntil(`build ${hostApp}`, (output) =>
      output.includes('Successfully ran target build')
    );
    await killProcessAndPorts(buildOutputSwc.pid);

    const buildOutputTsNode = await runCommandUntil(
      `build ${hostApp}`,
      (output) => output.includes('Successfully ran target build'),
      {
        env: { NX_PREFER_TS_NODE: 'true' },
      }
    );
    await killProcessAndPorts(buildOutputTsNode.pid);

    const processSwc = await runCommandUntil(
      `serve ${hostApp} --port=${hostPort} --dev-remotes=${remoteApp}`,
      (output) =>
        !output.includes(`Remote '${remoteApp}' failed to serve correctly`) &&
        output.includes(`listening on localhost:${hostPort}`)
    );

    await killProcessAndPorts(processSwc.pid, hostPort, remotePort);

    const processTsNode = await runCommandUntil(
      `serve ${hostApp} --port=${hostPort} --dev-remotes=${remoteApp}`,
      (output) =>
        !output.includes(`Remote '${remoteApp}' failed to serve correctly`) &&
        output.includes(`listening on localhost:${hostPort}`),
      {
        env: { NX_PREFER_TS_NODE: 'true' },
      }
    );

    await killProcessAndPorts(processTsNode.pid, hostPort, remotePort);
  }, 20_000_000);

  it('should federate a module from a library and update an existing remote', async () => {
    const lib = uniq('lib');
    const remote = uniq('remote');
    const module = uniq('module');
    const host = uniq('host');

    const hostPort = 4200;

    runCLI(
      `generate @nx/angular:host ${host} --remotes=${remote} --no-interactive --projectNameAndRootFormat=as-provided`
    );

    runCLI(
      `generate @nx/js:lib ${lib} --no-interactive --projectNameAndRootFormat=as-provided`
    );

    // Federate Module
    runCLI(
      `generate @nx/angular:federate-module ${lib}/src/index.ts --name=${module} --remote=${remote} --no-interactive`
    );

    updateFile(`${lib}/src/index.ts`, `export { isEven } from './lib/${lib}';`);
    updateFile(
      `${lib}/src/lib/${lib}.ts`,
      `export function isEven(num: number) { return num % 2 === 0; }`
    );

    // Update Host to use the module
    updateFile(
      `${host}/src/app/app.component.ts`,
      `
      import { Component } from '@angular/core';
      import { isEven } from '${remote}/${module}';

      @Component({
        selector: 'proj-root',
        template: \`<div class="host">{{title}}</div>\`,
        standalone: true
      })
      export class AppComponent {
        title = \`shell is \${isEven(2) ? 'even' : 'odd'}\`;
      }`
    );

    // Update e2e test to check the module
    updateFile(
      `${host}-e2e/src/e2e/app.cy.ts`,
      `
      describe('${host}', () => {
        beforeEach(() => cy.visit('/'));
      
        it('should display contain the remote library', () => {
          expect(cy.get('div.host')).to.exist;
          expect(cy.get('div.host').contains('shell is even'));
        });
      });
      
      `
    );

    // Build host and remote
    const buildHostOutput = runCLI(`build ${host}`);
    expect(buildHostOutput).toContain('Successfully ran target build');
    const buildRemoteOutput = runCLI(`build ${remote}`);
    expect(buildRemoteOutput).toContain('Successfully ran target build');

    if (runE2ETests('cypress')) {
      const e2eProcess = await runCommandUntil(
        `e2e ${host}-e2e --no-watch`,
        (output) => output.includes('All specs passed!')
      );
      await killProcessAndPorts(e2eProcess.pid, hostPort, hostPort + 1);
    }
  }, 500_000);

  it('should federate a module from a library and create a remote that is served recursively', async () => {
    const lib = uniq('lib');
    const remote = uniq('remote');
    const childRemote = uniq('childremote');
    const module = uniq('module');
    const host = uniq('host');
    const hostPort = 4200;

    runCLI(
      `generate @nx/angular:host ${host} --remotes=${remote} --no-interactive --projectNameAndRootFormat=as-provided`
    );

    runCLI(
      `generate @nx/js:lib ${lib} --no-interactive --projectNameAndRootFormat=as-provided`
    );

    // Federate Module
    runCLI(
      `generate @nx/angular:federate-module ${lib}/src/index.ts --name=${module} --remote=${childRemote} --no-interactive`
    );

    updateFile(`${lib}/src/index.ts`, `export { isEven } from './lib/${lib}';`);
    updateFile(
      `${lib}/src/lib/${lib}.ts`,
      `export function isEven(num: number) { return num % 2 === 0; }`
    );

    // Update Host to use the module
    updateFile(
      `${remote}/src/app/remote-entry/entry.component.ts`,
      `
      import { Component } from '@angular/core';
      import { isEven } from '${childRemote}/${module}';

      @Component({
        selector: 'proj-${remote}-entry',
        template: \`<div class="childremote">{{title}}</div>\`,
        standalone: true
      })
      export class RemoteEntryComponent {
        title = \`shell is \${isEven(2) ? 'even' : 'odd'}\`;
      }`
    );

    updateFile(
      `${remote}/module-federation.config.ts`,
      `
      import { ModuleFederationConfig } from '@nx/webpack';

      const config: ModuleFederationConfig = {
        name: '${remote}',
        remotes: ['${childRemote}'],
        exposes: {
          './Routes': '${remote}/src/app/remote-entry/entry.routes.ts',
          './Module': '${remote}/src/app/remote-entry/entry.component.ts',
        },
      };

      export default config;`
    );

    // Update e2e test to check the module
    updateFile(
      `${host}-e2e/src/e2e/app.cy.ts`,
      `
      describe('${host}', () => {
        beforeEach(() => cy.visit('/${remote}'));
      
        it('should display contain the remote library', () => {
          expect(cy.get('div.childremote')).to.exist;
          expect(cy.get('div.childremote').contains('shell is even'));
        });
      });
      
      `
    );

    // Build host and remote
    const buildHostOutput = runCLI(`build ${host}`);
    expect(buildHostOutput).toContain('Successfully ran target build');
    const buildRemoteOutput = runCLI(`build ${remote}`);
    expect(buildRemoteOutput).toContain('Successfully ran target build');

    if (runE2ETests('cypress')) {
      const e2eProcess = await runCommandUntil(
        `e2e ${host}-e2e --no-watch`,
        (output) => output.includes('All specs passed!')
      );
      await killProcessAndPorts(e2eProcess.pid, hostPort, hostPort + 1);
    }
  }, 500_000);
});
