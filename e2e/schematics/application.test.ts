import {
  newApp,
  newLib,
  newProject,
  runCLI,
  updateFile,
  cleanup
} from '../utils';

describe('Nrwl Workspace', () => {
  it(
    'should work',
    () => {
      newProject();
      newApp('myApp --directory=myDir');
      newLib('myLib --directory=myDir --ngmodule');

      updateFile(
        'apps/my-dir/my-app/src/app/app.module.ts',
        `
        import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { MyLibModule } from '@proj/my-dir/my-lib';
        import { AppComponent } from './app.component';

        @NgModule({
          imports: [BrowserModule, MyLibModule],
          declarations: [AppComponent],
          bootstrap: [AppComponent]
        })
        export class AppModule {}
      `
      );

      runCLI('build --aot -a=my-dir/my-app');
      expect(runCLI('test --single-run')).toContain('Executed 2 of 2 SUCCESS');
      expect(runCLI('e2e -a=my-dir/my-app')).toContain('my-app App');
    },
    1000000
  );

  it(
    'should support router config generation (lazy)',
    () => {
      newProject();
      newApp('myApp --directory=myDir --routing');
      newLib(
        'myLib --directory=myDir --routing --lazy --parentModule=apps/my-dir/my-app/src/app/app.module.ts'
      );

      runCLI('build --aot -a=my-dir/my-app');
      expect(runCLI('test --single-run')).toContain('Executed 2 of 2 SUCCESS');
    },
    1000000
  );

  it(
    'should support router config generation (eager)',
    () => {
      newProject();
      newApp('myApp --directory=myDir --routing');
      newLib(
        'myLib --directory=myDir --routing --parentModule=apps/my-dir/my-app/src/app/app.module.ts'
      );

      runCLI('build --aot -a=my-dir/my-app');
      expect(runCLI('test --single-run')).toContain('Executed 2 of 2 SUCCESS');
    },
    1000000
  );
});
