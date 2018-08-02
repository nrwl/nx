import { newApp, newProject, runCLI, updateFile } from '../utils';

describe('Upgrade', () => {
  it(
    'should generate an UpgradeModule setup',
    () => {
      newProject();
      newApp('myapp');

      updateFile(
        'apps/myapp/src/legacy.js',
        `
      const angular = window.angular.module('legacy', []);
      angular.component('proj-root-legacy', {
        template: 'Expected Value'
      });
    `
      );

      updateFile(
        'apps/myapp/src/app/app.component.html',
        `
      EXPECTED [<proj-root-legacy></proj-root-legacy>]
    `
      );

      updateFile('apps/myapp/src/app/app.component.spec.ts', ``);

      runCLI(
        'generate upgrade-module legacy --angularJsImport=./legacy ' +
          '--angularJsCmpSelector=proj-root-legacy --project=myapp'
      );

      expect(runCLI('lint', { silenceError: true })).not.toContain('ERROR');

      runCLI('build');
      runCLI('test --no-watch');
    },
    1000000
  );
});
