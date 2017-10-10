import {
  checkFilesExist,
  cleanup,
  copyMissingPackages,
  newApp,
  newLib,
  ngNew,
  readFile,
  runCLI,
  updateFile
} from '../utils';

describe('Nrwl Workspace', () => {
  beforeEach(cleanup);

  it('should generate an empty workspace', () => {
    ngNew('--collection=@nrwl/schematics --skip-install');

    const angularCliJson = JSON.parse(readFile('.angular-cli.json'));
    expect(angularCliJson.apps).toEqual([]);

    const packageJson = JSON.parse(readFile('package.json'));
    expect(packageJson.devDependencies['@nrwl/schematics']).toBeDefined();
    expect(packageJson.dependencies['@nrwl/nx']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/effects']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/router-store']).toBeDefined();
    expect(packageJson.dependencies['@ngrx/store-devtools']).toBeDefined();

    checkFilesExist('test.js', 'tsconfig.app.json', 'tsconfig.spec.json', 'tsconfig.e2e.json', 'apps', 'libs');
  });

  describe('app', () => {
    it('should generate an app', () => {
      ngNew('--collection=@nrwl/schematics --skip-install');
      newApp('myapp');

      const angularCliJson = JSON.parse(readFile('.angular-cli.json'));
      expect(angularCliJson.apps[0].name).toEqual('myapp');

      checkFilesExist(
        'apps/myapp/src/main.ts',
        'apps/myapp/src/app/app.module.ts',
        'apps/myapp/src/app/app.component.ts',
        'apps/myapp/e2e/app.po.ts'
      );
    });

    it(
      'should build app',
      () => {
        ngNew('--collection=@nrwl/schematics');
        copyMissingPackages();
        newApp('myapp');
        runCLI('build --aot');
        checkFilesExist('dist/apps/myapp/main.bundle.js');
        expect(runCLI('test --single-run')).toContain('Executed 1 of 1 SUCCESS');
      },
      100000
    );

    it('should have router-outlet in app.component.ts with routing flag', () => {
      ngNew('--collection=@nrwl/schematics --skip-install');
      newApp('myapp --routing');

      const contents = readFile('apps/myapp/src/app/app.component.html');

      expect(contents).toContain('<router-outlet></router-outlet>');
    });
  });

  describe('lib', () => {
    it('should generate a lib', () => {
      ngNew('--collection=@nrwl/schematics --skip-install');
      newLib('mylib');

      const angularCliJson = JSON.parse(readFile('.angular-cli.json'));
      expect(angularCliJson.apps[0].name).toEqual('mylib');

      checkFilesExist('libs/mylib/src/mylib.ts', 'libs/mylib/src/mylib.spec.ts', 'libs/mylib/index.ts');
    });

    it(
      'should test a lib',
      () => {
        ngNew('--collection=@nrwl/schematics');
        copyMissingPackages();
        newApp('myapp');
        newLib('generate lib mylib');

        expect(runCLI('test --single-run')).toContain('Executed 2 of 2 SUCCESS');
      },
      100000
    );
  });

  describe('nglib', () => {
    it('should generate an ng lib', () => {
      ngNew('--collection=@nrwl/schematics --skip-install');
      newLib('mylib --ngmodule');

      checkFilesExist('libs/mylib/src/mylib.module.ts', 'libs/mylib/src/mylib.module.spec.ts', 'libs/mylib/index.ts');
    });

    it(
      'should test an ng lib',
      () => {
        ngNew('--collection=@nrwl/schematics');
        copyMissingPackages();
        newApp('myapp');
        newLib('mylib --ngmodule');

        expect(runCLI('test --single-run')).toContain('Executed 2 of 2 SUCCESS');
      },
      100000
    );

    it(
      'should resolve dependencies on the lib',
      () => {
        ngNew('--collection=@nrwl/schematics --npmScope=nrwl');
        copyMissingPackages();
        newApp('myapp');
        newLib('mylib --ngmodule');

        updateFile(
          'apps/myapp/src/app/app.module.ts',
          `
        import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { MylibModule } from '@nrwl/mylib';
        import { AppComponent } from './app.component';

        @NgModule({
          imports: [BrowserModule, MylibModule],
          declarations: [AppComponent],
          bootstrap: [AppComponent]
        })
        export class AppModule {}
      `
        );

        runCLI('build --aot');
      },
      100000
    );
  });
});
