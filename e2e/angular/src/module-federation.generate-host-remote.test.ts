import { names } from '@nx/devkit';
import {
  checkFilesExist,
  killProcessAndPorts,
  runCLI,
  runCommandUntil,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

import {
  getModuleFederationProjectName,
  readPort,
  setupModuleFederationSuite,
} from './module-federation.setup';

describe('Angular Module Federation - generate host and remote', () => {
  setupModuleFederationSuite();

  it('should generate valid host and remote apps', async () => {
    const proj = getModuleFederationProjectName();
    const hostApp = uniq('app');
    const remoteApp1 = uniq('remote');
    const sharedLib = uniq('shared-lib');
    const wildcardLib = uniq('wildcard-lib');
    const secondaryEntry = uniq('secondary');
    const hostPort = 4300;
    const remotePort = 4301;

    runCLI(
      `generate @nx/angular:host ${hostApp} --style=css --no-standalone --no-interactive`
    );
    runCLI(
      `generate @nx/angular:remote ${remoteApp1} --host=${hostApp} --port=${remotePort} --style=css --no-standalone --no-interactive`
    );

    checkFilesExist(
      `${hostApp}/src/app/app-module.ts`,
      `${remoteApp1}/src/app/app-module.ts`
    );

    const buildOutput = runCLI(`build ${hostApp}`);
    expect(buildOutput).toContain('Successfully ran target build');

    runCLI(
      `generate @nx/angular:library ${sharedLib} --buildable --no-standalone --no-interactive`
    );
    runCLI(
      `generate @nx/angular:library-secondary-entry-point --library=${sharedLib} --name=${secondaryEntry} --no-interactive`
    );

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
});

