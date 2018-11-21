import {
  newApp,
  newLib,
  newProject,
  readJson,
  runCLI,
  updateFile,
  fileExists,
  exists,
  runNgNew,
  cleanup,
  copyMissingPackages
} from '../utils';

describe('Nrwl Workspace', () => {
  it(
    'should work',
    () => {
      newProject();
      newApp('myApp --directory=myDir');
      newLib('myLib --directory=myDir');

      updateFile(
        'apps/my-dir/my-app/src/app/app.module.ts',
        `
        import { NgModule } from '@angular/core';
        import { BrowserModule } from '@angular/platform-browser';
        import { MyDirMyLibModule } from '@proj/my-dir/my-lib';
        import { AppComponent } from './app.component';

        @NgModule({
          imports: [BrowserModule, MyDirMyLibModule],
          declarations: [AppComponent],
          bootstrap: [AppComponent]
        })
        export class AppModule {}
      `
      );
      runCLI('build --aot --project=my-dir-my-app');

      // running tests for the app
      expect(runCLI('test --project=my-dir-my-app --no-watch')).toContain(
        'Executed 3 of 3 SUCCESS'
      );

      // running tests for the lib
      expect(runCLI('test --project=my-dir-my-lib --no-watch')).toContain(
        'Executed 1 of 1 SUCCESS'
      );

      // e2e tests
      expect(runCLI('e2e --project=my-dir-my-app-e2e')).toContain(
        'Executed 1 of 1 spec SUCCESS'
      );
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

      runCLI('build --aot --project=my-dir-my-app');
      expect(runCLI('test --project=my-dir-my-app --no-watch')).toContain(
        'Executed 3 of 3 SUCCESS'
      );
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

      runCLI('build --aot --project=my-dir-my-app');
      expect(runCLI('test  --project=my-dir-my-app --no-watch')).toContain(
        'Executed 3 of 3 SUCCESS'
      );
    },
    1000000
  );

  it('should support scss for styles', () => {
    cleanup();
    runNgNew('--collection=@nrwl/schematics --npmScope=proj --style scss');
    copyMissingPackages();
    newApp('myApp --directory=myDir');
    newLib(
      'myLib --directory=myDir --routing --parentModule=apps/my-dir/my-app/src/app/app.module.ts'
    );
    runCLI('generate component comp --project my-dir-my-app');
    runCLI('generate component comp --project my-dir-my-lib');

    expect(
      exists('./tmp/proj/apps/my-dir/my-app/src/app/comp/comp.component.scss')
    ).toEqual(true);
    expect(
      exists('./tmp/proj/libs/my-dir/my-lib/src/lib/comp/comp.component.scss')
    ).toEqual(true);
  });

  it(
    'should not generate e2e configuration',
    () => {
      newProject();
      newApp('myApp --e2eTestRunner=none');

      // Making sure the angular.json file doesn't contain e2e project
      const angularJson = readJson('angular.json');
      expect(angularJson['my-app-e2e']).toBeUndefined();

      // Making sure the nx.json file doesn't contain e2e project
      const nxJson = readJson('angular.json');
      expect(nxJson.projects['my-app-e2e']).toBeUndefined();

      // Making sure the e2e folder is not created
      expect(fileExists('apps/my-app-e2e')).toBeFalsy();
    },
    1000000
  );
});
