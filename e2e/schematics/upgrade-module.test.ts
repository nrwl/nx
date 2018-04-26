import { newApp, newProject, runCLI, updateFile } from '../utils';

xdescribe('Upgrade', () => {
  it(
    'should generate an UpgradeModule setup',
    () => {
      newProject();
      newApp('myapp');

      updateFile(
        'apps/myapp/src/legacy.js',
        `
      const angular = window.angular.module('legacy', []);
      angular.component('rootLegacyCmp', {
        template: 'Expected Value'
      });
    `
      );

      updateFile(
        'apps/myapp/src/app/app.component.html',
        `
      EXPECTED [<rootLegacyCmp></rootLegacyCmp>]
    `
      );

      updateFile('apps/myapp/src/app/app.component.spec.ts', ``);

      runCLI(
        'generate upgrade-module legacy --angularJsImport=./legacy ' +
          '--angularJsCmpSelector=rootLegacyCmp'
      );

      runCLI('build');
      runCLI('test --single-run');
    },
    1000000
  );
});
