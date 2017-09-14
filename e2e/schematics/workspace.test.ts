import {checkFilesExists, cleanup, copyMissingPackages, newApp, readFile, runCLI, runSchematic, updateFile} from '../utils';

describe('Nrwl Workspace', () => {
  beforeEach(cleanup);

  it('should generate an empty workspace', () => {
    newApp('--collection=@nrwl/schematics --skip-install');

    const angularCliJson = JSON.parse(readFile('.angular-cli.json'));
    expect(angularCliJson.apps).toEqual([]);

    const packageJson = JSON.parse(readFile('package.json'));
    expect(packageJson.devDependencies['@nrwl/schematics']).toBeDefined();
    expect(packageJson.dependencies['@nrwl/nx']).toBeDefined();
    checkFilesExists('test.js', 'tsconfig.app.json', 'tsconfig.spec.json', 'tsconfig.e2e.json', 'apps', 'libs');
  });

  describe('app', () => {
    it('should generate an app', () => {
      newApp('--collection=@nrwl/schematics');
      copyMissingPackages();
      runSchematic('@nrwl/schematics:app --name=myapp');

      const angularCliJson = JSON.parse(readFile('.angular-cli.json'));
      expect(angularCliJson.apps[0].name).toEqual('myapp');

      checkFilesExists(
          'apps/myapp/src/main.ts', 'apps/myapp/src/app/app.module.ts', 'apps/myapp/src/app/app.component.ts',
          'apps/myapp/e2e/app.po.ts');

      runCLI('build --aot');
      checkFilesExists('dist/apps/myapp/main.bundle.js');

      expect(runCLI('test --single-run')).toContain('Executed 1 of 1 SUCCESS');
    });
  });

  describe('lib', () => {
    it('should generate a lib', () => {
      newApp('--collection=@nrwl/schematics --skip-install');
      runSchematic('@nrwl/schematics:lib --name=mylib');

      checkFilesExists('libs/mylib/src/mylib.ts', 'libs/mylib/src/mylib.spec.ts', 'libs/mylib/index.ts');
    });

    it('should test a lib', () => {
      newApp('--collection=@nrwl/schematics');
      copyMissingPackages();
      runSchematic('@nrwl/schematics:app --name=myapp');
      runSchematic('@nrwl/schematics:lib --name=mylib');

      expect(runCLI('test --single-run')).toContain('Executed 2 of 2 SUCCESS');
    });
  });

  describe('nglib', () => {
    it('should generate an ng lib', () => {
      newApp('--collection=@nrwl/schematics --skip-install');
      runSchematic('@nrwl/schematics:lib --name=mylib --ngmodule');

      checkFilesExists('libs/mylib/src/mylib.module.ts', 'libs/mylib/src/mylib.module.spec.ts', 'libs/mylib/index.ts');
    });

    it('should test an ng lib', () => {
      newApp('--collection=@nrwl/schematics');
      copyMissingPackages();
      runSchematic('@nrwl/schematics:app --name=myapp');
      runSchematic('@nrwl/schematics:lib --name=mylib --ngmodule');

      expect(runCLI('test --single-run')).toContain('Executed 2 of 2 SUCCESS');
    });

    it('should resolve dependencies on the lib', () => {
      newApp('--collection=@nrwl/schematics --npmScope=nrwl');
      copyMissingPackages();
      runSchematic('@nrwl/schematics:app --name=myapp');
      runSchematic('@nrwl/schematics:lib --name=mylib --ngmodule');

      updateFile('apps/myapp/src/app/app.module.ts', `
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
      `);

      runCLI('build --aot');
    });
  });
});
