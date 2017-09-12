import {checkFilesExists, cleanup, newApp, readFile, runCLI, runSchematic, updateFile} from '../utils';

describe('Nrwl Convert to Nx Workspace', () => {
  beforeEach(cleanup);

  it('should generate a workspace', () => {
    newApp('new proj --skip-install --npmScope=nrwl');

    // update package.json
    const packageJson = JSON.parse(readFile('proj/package.json'));
    packageJson.description = 'some description';
    packageJson.dependencies['@ngrx/store'] = '4.0.3';
    packageJson.devDependencies['@ngrx/router-store'] = '4.0.3';
    updateFile('proj/package.json', JSON.stringify(packageJson, null, 2));

    // update tsconfig.json
    const tsconfigJson = JSON.parse(readFile('proj/tsconfig.json'));
    tsconfigJson.compilerOptions.paths = {'a': ['b']};
    updateFile('proj/tsconfig.json', JSON.stringify(tsconfigJson, null, 2));


    // run the command
    runSchematic('@nrwl/schematics:convert-to-workspace', {projectName: 'proj'});

    // check that files have been moved!
    checkFilesExists('proj/apps/proj/src/main.ts', 'proj/apps/proj/src/app/app.module.ts');

    // check that package.json got merged
    const updatedPackageJson = JSON.parse(readFile('proj/package.json'));
    expect(updatedPackageJson.description).toEqual('some description');
    expect(updatedPackageJson.dependencies['@ngrx/store']).toEqual('4.0.3');
    expect(updatedPackageJson.devDependencies['@ngrx/router-store']).toEqual('4.0.3');
    expect(updatedPackageJson.devDependencies['@nrwl/schematics']).toBeDefined();
    expect(updatedPackageJson.dependencies['@nrwl/nx']).toBeDefined();

    // check if angular-cli.json get merged
    const updatedAngularCLIJson = JSON.parse(readFile('proj/.angular-cli.json'));
    expect(updatedAngularCLIJson.apps[0].root).toEqual('apps/proj/src');
    expect(updatedAngularCLIJson.apps[0].outDir).toEqual('dist/apps/proj');
    expect(updatedAngularCLIJson.apps[0].test).toEqual('../../../test.js');
    expect(updatedAngularCLIJson.apps[0].tsconfig).toEqual('../../../tsconfig.app.json');
    expect(updatedAngularCLIJson.apps[0].testTsconfig).toEqual('../../../tsconfig.spec.json');

    // check if tsconfig.json get merged
    const updatedTsConfig = JSON.parse(readFile('proj/tsconfig.json'));
    expect(updatedTsConfig.compilerOptions.paths).toEqual({'a': ['b'], '@nrwl/*': ['libs/*']});
  });

  it('should build and test', () => {
    newApp('new proj');
    runSchematic('@nrwl/schematics:convert-to-workspace --npmScope=nrwl', {projectName: 'proj'});
    runSchematic('@nrwl/schematics:lib --name=mylib --ngmodule', {projectName: 'proj'});

    updateFile('proj/apps/proj/src/app/app.module.ts', `
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

    expect(runCLI('build --aot', {projectName: 'proj'})).toContain('{main} main.bundle.js');
    expect(runCLI('test --single-run', {projectName: 'proj'})).toContain('Executed 4 of 4 SUCCESS');
  });
});
