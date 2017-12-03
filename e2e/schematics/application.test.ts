import { newApp, newLib, newProject, runCLI, updateFile } from '../utils';

describe('Nrwl Workspace', () => {
  it(
    'should work',
    () => {
      newProject();
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
    1000000
  );

  it(
    'should support router config generation (lazy)',
    () => {
      newProject();
      newApp('myapp --routing');
      newLib('mylib --routing --lazy --parentModule=apps/myapp/src/app/app.module.ts');

      runCLI('build --aot');
      expect(runCLI('test --single-run')).toContain('Executed 2 of 2 SUCCESS');
    },
    1000000
  );

  it(
    'should support router config generation (eager)',
    () => {
      newProject();
      newApp('myapp --routing');
      newLib('mylib --routing --parentModule=apps/myapp/src/app/app.module.ts');

      runCLI('build --aot');
      expect(runCLI('test --single-run')).toContain('Executed 2 of 2 SUCCESS');
    },
    1000000
  );
});
