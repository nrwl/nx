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

  it(
    'should work',
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
      expect(runCLI('test --single-run')).toContain('Executed 2 of 2 SUCCESS');
    },
    100000
  );
});
