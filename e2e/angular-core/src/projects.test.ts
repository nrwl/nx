import {
  checkFilesExist,
  getSize,
  killPorts,
  newProject,
  cleanupProject,
  runCLI,
  tmpProjPath,
  uniq,
  updateFile,
  runCypressTests,
  updateProjectConfig,
  readFile,
  runCommandUntil,
  promisifiedTreeKill,
} from '@nrwl/e2e/utils';
import { ChildProcess } from 'child_process';

import { names } from '@nrwl/devkit';

describe('Angular Projects', () => {
  let proj: string;

  beforeAll(() => (proj = newProject()));
  afterAll(() => cleanupProject());

  it('should generate an app, a lib, link them, build, serve and test both correctly', async () => {
    const myapp = uniq('myapp');
    const myapp2 = uniq('myapp2');
    const mylib = uniq('mylib');
    runCLI(
      `generate @nrwl/angular:app ${myapp} --directory=myDir --no-interactive`
    );
    runCLI(
      `generate @nrwl/angular:app ${myapp2} --directory=myDir --no-interactive`
    );
    runCLI(
      `generate @nrwl/angular:lib ${mylib} --directory=myDir --add-module-spec --no-interactive`
    );

    updateFile(
      `apps/my-dir/${myapp}/src/app/app.module.ts`,
      `
          import { NgModule } from '@angular/core';
          import { BrowserModule } from '@angular/platform-browser';
          import { MyDir${
            names(mylib).className
          }Module } from '@${proj}/my-dir/${mylib}';
          import { AppComponent } from './app.component';
          import { NxWelcomeComponent } from './nx-welcome.component';
  
          @NgModule({
            imports: [BrowserModule, MyDir${names(mylib).className}Module],
            declarations: [AppComponent, NxWelcomeComponent],
            bootstrap: [AppComponent]
          })
          export class AppModule {}
        `
    );
    runCLI(
      `run-many --target build --projects=my-dir-${myapp},my-dir-${myapp2} --parallel --prod --output-hashing none`
    );

    checkFilesExist(`dist/apps/my-dir/${myapp}/main.js`);

    // This is a loose requirement because there are a lot of
    // influences external from this project that affect this.
    const es2015BundleSize = getSize(
      tmpProjPath(`dist/apps/my-dir/${myapp}/main.js`)
    );
    console.log(
      `The current es2015 bundle size is ${es2015BundleSize / 1000} KB`
    );
    expect(es2015BundleSize).toBeLessThanOrEqual(160000);

    runCLI(
      `run-many --target test --projects=my-dir-${myapp},my-dir-${mylib} --parallel`
    );

    if (runCypressTests()) {
      const e2eResults = runCLI(`e2e my-dir-${myapp}-e2e --no-watch`);
      expect(e2eResults).toContain('All specs passed!');
      expect(await killPorts()).toBeTruthy();
    }

    const process = await runCommandUntil(
      `serve my-dir-${myapp} -- --port=4207`,
      (output) => output.includes(`listening on localhost:4207`)
    );

    // port and process cleanup
    try {
      await promisifiedTreeKill(process.pid, 'SIGKILL');
      await killPorts(4207);
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 1000000);

  it('should build the dependent buildable lib and its child lib, as well as the app', () => {
    // ARRANGE
    const app = uniq('app');
    const buildableLib = uniq('buildlib1');
    const buildableChildLib = uniq('buildlib2');

    runCLI(`generate @nrwl/angular:app ${app} --style=css --no-interactive`);
    runCLI(
      `generate @nrwl/angular:library ${buildableLib} --buildable=true --no-interactive`
    );
    runCLI(
      `generate @nrwl/angular:library ${buildableChildLib} --buildable=true --no-interactive`
    );

    // update the app module to include a ref to the buildable lib
    updateFile(
      `apps/${app}/src/app/app.module.ts`,
      `
        import { BrowserModule } from '@angular/platform-browser';
        import { NgModule } from '@angular/core';
        import {${
          names(buildableLib).className
        }Module} from '@${proj}/${buildableLib}';

        import { AppComponent } from './app.component';
        import { NxWelcomeComponent } from './nx-welcome.component';

        @NgModule({
          declarations: [AppComponent, NxWelcomeComponent],
          imports: [BrowserModule, ${names(buildableLib).className}Module],
          providers: [],
          bootstrap: [AppComponent],
        })
        export class AppModule {}
    `
    );

    // update the buildable lib module to include a ref to the buildable child lib
    updateFile(
      `libs/${buildableLib}/src/lib/${names(buildableLib).fileName}.module.ts`,
      `
        import { NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';
        import { ${
          names(buildableChildLib).className
        }Module } from '@${proj}/${buildableChildLib}';
        
        @NgModule({
          imports: [CommonModule, ${names(buildableChildLib).className}Module],
        })
        export class ${names(buildableLib).className}Module {}
        
      `
    );

    // update the angular.json
    updateProjectConfig(app, (config) => {
      config.targets.build.executor = '@nrwl/angular:webpack-browser';
      config.targets.build.options = {
        ...config.targets.build.options,
        buildLibsFromSource: false,
      };
      return config;
    });

    // ACT
    const libOutput = runCLI(`build ${app} --configuration=development`);

    // ASSERT
    expect(libOutput).toContain(
      `Building entry point '@${proj}/${buildableLib}'`
    );
    expect(libOutput).toContain(`nx run ${app}:build:development`);

    // to proof it has been built from source the "main.js" should actually contain
    // the path to dist
    const mainBundle = readFile(`dist/apps/${app}/main.js`);
    expect(mainBundle).toContain(`dist/libs/${buildableLib}`);
  });

  it('should build publishable libs successfully', () => {
    // ARRANGE
    const lib = uniq('lib');
    const childLib = uniq('child');
    const entryPoint = uniq('entrypoint');

    runCLI(
      `generate @nrwl/angular:lib ${lib} --publishable --importPath=@${proj}/${lib} --no-interactive`
    );
    runCLI(
      `generate @nrwl/angular:secondary-entry-point --name=${entryPoint} --library=${lib} --no-interactive`
    );

    runCLI(
      `generate @nrwl/angular:library ${childLib} --publishable=true --importPath=@${proj}/${childLib} --no-interactive`
    );

    // create secondary entrypoint
    updateFile(
      `libs/${childLib}/sub/package.json`,
      `
  {
    "ngPackage": {}
  }
`
    );
    updateFile(
      `libs/${childLib}/sub/src/lib/sub.module.ts`,
      `
  import { NgModule } from '@angular/core';
  import { CommonModule } from '@angular/common';
  @NgModule({ imports: [CommonModule] })
  export class SubModule {}
`
    );

    updateFile(
      `libs/${childLib}/sub/src/public_api.ts`,
      `export * from './lib/sub.module';`
    );

    updateFile(
      `libs/${childLib}/sub/src/index.ts`,
      `export * from './public_api';`
    );

    updateFile(`tsconfig.base.json`, (s) => {
      return s.replace(
        `"@${proj}/${childLib}": ["libs/${childLib}/src/index.ts"],`,
        `"@${proj}/${childLib}": ["libs/${childLib}/src/index.ts"],
"@${proj}/${childLib}/sub": ["libs/${childLib}/sub/src/index.ts"],
`
      );
    });

    const moduleContent = `
    import { NgModule } from '@angular/core';
    import { CommonModule } from '@angular/common';
          import { ${
            names(childLib).className
          }Module } from '@${proj}/${childLib}';
    import { SubModule } from '@${proj}/${childLib}/sub';
    @NgModule({
      imports: [CommonModule, ${names(childLib).className}Module, SubModule]
    })
    export class ${names(lib).className}Module {}`;

    updateFile(`libs/${lib}/src/lib/${lib}.module.ts`, moduleContent);

    // ACT
    const buildOutput = runCLI(`build ${lib}`);

    // ASSERT
    expect(buildOutput).toContain(`Building entry point '@${proj}/${lib}'`);
    expect(buildOutput).toContain(
      `Building entry point '@${proj}/${lib}/${entryPoint}'`
    );
    expect(buildOutput).toContain('Successfully ran target build');
  });

  it('MFE - should serve the host and remote apps successfully, even with a shared library between them', async () => {
    // ACT + ASSERT
    const port1 = 4200;
    const port2 = 4206;
    const hostApp = uniq('app');
    const remoteApp1 = uniq('remote');
    const sharedLib = uniq('sharedLib');

    // generate host app
    runCLI(
      `generate @nrwl/angular:host ${hostApp} --style=css --no-interactive`
    );

    // generate remote apps
    runCLI(
      `generate @nrwl/angular:remote ${remoteApp1} --host=${hostApp} --port=${port2} --style=css --no-interactive`
    );

    // generate a shared lib
    runCLI(`generate @nrwl/angular:library ${sharedLib} --no-interactive`);

    // update the files to use shared library
    updateFile(
      `apps/${hostApp}/src/app/app.module.ts`,
      `import { NgModule } from '@angular/core';
      import { BrowserModule } from '@angular/platform-browser';
      import { ${
        names(sharedLib).className
      }Module } from '@${proj}/${sharedLib}';
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
      await killPorts(port1);
      await killPorts(port2);
    } catch (err) {
      expect(err).toBeFalsy();
    }
  }, 300000);

  it('MFE - should build the host app successfully', async () => {
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
});
