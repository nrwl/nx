import { newApp, newProject, runCLI, updateFile } from '../utils';

describe('DowngradeModule', () => {
  it(
    'should generate a downgradeModule setup',
    () => {
      newProject();
      newApp('myapp');

      updateFile(
        'apps/myapp/src/legacy.js',
        `window.angular.module('legacy', []);`
      );

      runCLI(
        'generate downgrade-module legacy --angularJsImport=./legacy --project=myapp'
      );

      runCLI('build');
      expect(runCLI('test --no-watch')).toContain('Executed 3 of 3 SUCCESS');
    },
    1000000
  );
});
